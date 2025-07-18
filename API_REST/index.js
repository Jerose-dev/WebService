const express = require("express");
const postgres = require("postgres");

const crypto = require("crypto");

const app = express();
const port = 8000;

const z = require("zod");

const hashPassword = (password) => {
    return crypto.createHash("sha512").update(password).digest("hex");
};

const UserSchema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(8),
});

const PartialUserSchema = UserSchema.partial();

app.use(express.json());

// Middleware JSON parser
app.use(express.json());

// Connexion à la base PostgreSQL
const sql = postgres({
    host: "localhost",      // ou ton host DB
    port: 5432,             // port par défaut PostgreSQL
    username: "postgres",   // adapte selon ton config
    password: "$$Elea05032013$$", // idem
    database: "MythicGames"     // idem
});

// Schemas
const ProductsSchema = z.object({
    id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
});

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const OrderSchema = z.object({
    userId: z.number().int(),
    productIds: z.array(z.number().int()).nonempty(),
});

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
});
// --- ROUTES ---

// GET /products/:id - Récupérer un produit par id
app.get("/products/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("ID invalide");

    try {
        const product = await sql`SELECT * FROM products WHERE id = ${id}`;
        if (product.length === 0) return res.status(404).send("Produit non trouvé");
        res.json(product[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

// GET /products - Récupérer tous les produits avec pagination
app.get("/products", async (req, res) => {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    const offset = (page - 1) * limit;

    try {
        const products = await sql`
      SELECT * FROM products
      ORDER BY id
      LIMIT ${limit} OFFSET ${offset}
    `;
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});


const CreateProductsSchema = ProductsSchema.omit({ id: true });
// POST /products - Créer un nouveau produit
app.post("/products", (req, res) => {
    try {
        const validated = CreateProductsSchema.parse(req.body);
        // Insertion en base
        sql`
      INSERT INTO products (name, price)
      VALUES (${validated.name}, ${validated.price})
      RETURNING *;
    `.then((result) => {
            res.status(201).json(result[0]);
        }).catch((err) => {
            console.error(err);
            res.status(500).send("Erreur base de données");
        });
    } catch (e) {
        res.status(400).json({ errors: e.errors });
    }
});

// DELETE /products/:id - Supprimer un produit
app.delete("/products/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("ID invalide");

    try {
        const result = await sql`
      DELETE FROM products WHERE id = ${req.params.id} RETURNING *;
    `;
        if (result.length === 0) return res.status(404).send("Produit non trouvé");
        console.log(result)
        res.status(200).send(result[0]); // No Content
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

// --- Démarrage serveur ---
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});

// --- ROUTES USERS ---

// POST /users - Créer un utilisateur
app.post("/users", async (req, res) => {
    const parsed = UserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

    const { username, email, password } = parsed.data;
    const hashed = hashPassword(password);

    try {
        const result = await sql`
            INSERT INTO users (username, email, password)
            VALUES (${username}, ${email}, ${hashed})
            RETURNING id, username, email;
        `;
        res.status(201).json(result[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

// GET /users/:id - Récupérer un utilisateur (sans password)
app.get("/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("ID invalide");

    try {
        const result = await sql`
            SELECT id, username, email FROM users WHERE id = ${id}
        `;
        if (result.length === 0) return res.status(404).send("Utilisateur non trouvé");
        res.json(result[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

// PUT /users/:id - Remplacer un utilisateur
app.put("/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("ID invalide");

    const parsed = UserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

    const { username, email, password } = parsed.data;
    const hashed = hashPassword(password);

    try {
        const result = await sql`
            UPDATE users
            SET username = ${username}, email = ${email}, password = ${hashed}
            WHERE id = ${id}
            RETURNING id, username, email;
        `;
        if (result.length === 0) return res.status(404).send("Utilisateur non trouvé");
        res.json(result[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

// PATCH /users/:id - Modifier partiellement un utilisateur
app.patch("/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("ID invalide");

    const parsed = PartialUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

    const fields = [];
    const values = [];
    let i = 1;

    for (const key in parsed.data) {
        let val = parsed.data[key];
        if (key === "password") val = hashPassword(val);
        fields.push(`${key} = $${i}`);
        values.push(val);
        i++;
    }

    if (fields.length === 0) return res.status(400).send("Aucune donnée à mettre à jour");

    values.push(id);
    const query = `UPDATE users SET ${fields.join(", ")} WHERE id = $${i} RETURNING id, username, email`;

    try {
        const result = await sql.unsafe(query, values);
        if (result.length === 0) return res.status(404).send("Utilisateur non trouvé");
        res.json(result[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

// DELETE /users/:id
app.delete("/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("ID invalide");

    try {
        const result = await sql`
            DELETE FROM users WHERE id = ${id} RETURNING id, username, email;
        `;
        if (result.length === 0) return res.status(404).send("Utilisateur non trouvé");
        res.json(result[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

// Route GET /f2p-games - Tous les jeux
app.get("/f2p-games", async (req, res) => {
    try {
        const response = await fetch("https://www.freetogame.com/api/games");
        const games = await response.json();
        res.json(games);
    } catch (err) {
        console.error("Erreur FreeToGame API :", err);
        res.status(500).send("Erreur lors de la récupération des jeux");
    }
});

// Route GET /f2p-games/:id - Un seul jeu
app.get("/f2p-games/:id", async (req, res) => {
    const id = req.params.id;
    try {
        const response = await fetch(`https://www.freetogame.com/api/game?id=${id}`);
        if (!response.ok) return res.status(404).send("Jeu non trouvé");
        const game = await response.json();
        res.json(game);
    } catch (err) {
        console.error("Erreur FreeToGame API :", err);
        res.status(500).send("Erreur lors de la récupération du jeu");
    }
});

app.post("/orders", async (req, res) => {
    try {
        const { userId, productIds } = OrderSchema.parse(req.body);

        // Vérification des produits
        const products = await sql`
      SELECT * FROM products WHERE id = ANY(${productIds})
    `;
        if (products.length !== productIds.length) {
            return res.status(400).send("Certains produits sont introuvables");
        }

        // Calcul du total avec TVA 20%
        const rawTotal = products.reduce((sum, p) => sum + Number(p.price), 0);
        const total = Number((rawTotal * 1.2).toFixed(2));

        const [order] = await sql`
      INSERT INTO orders (user_id, product_ids, total)
      VALUES (${userId}, ${productIds}, ${total})
      RETURNING *;
    `;
        res.status(201).json(order);
    } catch (err) {
        console.error(err);
        res.status(400).send("Erreur de validation ou d'insertion");
    }
});

app.get("/orders/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send("ID invalide");

    try {
        const [order] = await sql`SELECT * FROM orders WHERE id = ${id}`;
        if (!order) return res.status(404).send("Commande non trouvée");

        const [user] = await sql`SELECT id, username, email FROM users WHERE id = ${order.user_id}`;
        const products = await sql`
      SELECT * FROM products WHERE id = ANY(${order.product_ids})
    `;

        res.json({
            ...order,
            user,
            products,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

app.get("/orders", async (req, res) => {
    try {
        const orders = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

app.patch("/orders/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const { payment } = req.body;

    if (typeof payment !== "boolean") return res.status(400).send("Champ 'payment' requis");

    try {
        const [updated] = await sql`
      UPDATE orders
      SET payment = ${payment}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
        if (!updated) return res.status(404).send("Commande non trouvée");

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

app.delete("/orders/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const [deleted] = await sql`DELETE FROM orders WHERE id = ${id} RETURNING *`;
        if (!deleted) return res.status(404).send("Commande non trouvée");
        res.status(200).json(deleted);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});

app.get("/products", async (req, res) => {
    try {
        const { name, about, price, page = 1, limit = 10 } = req.query;

        let filters = [];
        let values = [];

        // Construire dynamiquement les filtres
        if (name) {
            values.push(`%${name.toLowerCase()}%`);
            filters.push(sql`LOWER(name) LIKE ${values[values.length - 1]}`);
        }
        if (about) {
            values.push(`%${about.toLowerCase()}%`);
            filters.push(sql`LOWER(about) LIKE ${values[values.length - 1]}`);
        }
        if (price) {
            const priceNum = Number(price);
            if (!isNaN(priceNum)) {
                filters.push(sql`price <= ${priceNum}`);
            }
        }

        // Pagination
        const limitNum = Number(limit) > 0 ? Number(limit) : 10;
        const offsetNum = (Number(page) > 1 ? Number(page) - 1 : 0) * limitNum;

        // Construire la requête SQL avec les filtres
        let query = sql`SELECT * FROM products`;
        if (filters.length > 0) {
            query = sql`${query} WHERE ${sql.join(filters, sql` AND `)}`;
        }
        query = sql`${query} ORDER BY id LIMIT ${limitNum} OFFSET ${offsetNum}`;

        // Exécuter la requête
        const products = await query;
        res.json(products);

    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});