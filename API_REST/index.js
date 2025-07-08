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
