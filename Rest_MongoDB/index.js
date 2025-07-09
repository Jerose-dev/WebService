// All other imports here.
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const { z } = require("zod");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

// Schemas
const ProductSchema = z.object({
    _id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
    categoryIds: z.array(z.string())
});
const CreateProductSchema = ProductSchema.omit({ _id: true });

const CategorySchema = z.object({
    _id: z.string(),
    name: z.string(),
});
const CreateCategorySchema = CategorySchema.omit({ _id: true });

// Init mongodb client connection
client.connect().then(() => {
    db = client.db("MyDB");
    app.listen(port, () => {
        console.log(`Listening on http://localhost:${port}`);
    });
});

// POST /products
app.post("/products", async (req, res) => {
    const result = await CreateProductSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result);

    const { name, about, price, categoryIds } = result.data;
    const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

    const ack = await db.collection("products").insertOne({
        name,
        about,
        price,
        categoryIds: categoryObjectIds
    });

    const product = await db.collection("products").findOne({ _id: ack.insertedId });
    res.status(201).send(product);
});

// GET /products
app.get("/products", async (req, res) => {
    const filters = {};
    const { name, about, price } = req.query;

    if (name) filters.name = { $regex: name, $options: "i" };
    if (about) filters.about = { $regex: about, $options: "i" };
    if (price) filters.price = { $lte: parseFloat(price) };

    const result = await db.collection("products").aggregate([
        { $match: filters },
        {
            $lookup: {
                from: "categories",
                localField: "categoryIds",
                foreignField: "_id",
                as: "categories",
            },
        },
    ]).toArray();

    res.send(result);
});

// GET /products/:id
app.get("/products/:id", async (req, res) => {
    try {
        const _id = new ObjectId(req.params.id);
        const result = await db.collection("products").aggregate([
            { $match: { _id } },
            {
                $lookup: {
                    from: "categories",
                    localField: "categoryIds",
                    foreignField: "_id",
                    as: "categories",
                },
            },
        ]).toArray();

        if (result.length === 0) return res.status(404).send("Produit non trouvé");
        res.send(result[0]);
    } catch {
        res.status(400).send("ID invalide");
    }
});

// PUT /products/:id
app.put("/products/:id", async (req, res) => {
    const result = await CreateProductSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result);

    try {
        const _id = new ObjectId(req.params.id);
        const update = result.data;
        update.categoryIds = update.categoryIds.map(id => new ObjectId(id));

        const response = await db.collection("products").findOneAndUpdate(
            { _id },
            { $set: update },
            { returnDocument: "after" }
        );

        if (!response.value) return res.status(404).send("Produit non trouvé");
        res.send(response.value);
    } catch {
        res.status(400).send("ID invalide");
    }
});

// PATCH /products/:id
app.patch("/products/:id", async (req, res) => {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.about) updates.about = req.body.about;
    if (typeof req.body.price === "number" && req.body.price > 0) updates.price = req.body.price;
    if (Array.isArray(req.body.categoryIds)) {
        updates.categoryIds = req.body.categoryIds.map(id => new ObjectId(id));
    }

    if (Object.keys(updates).length === 0) return res.status(400).send("Aucune mise à jour valide");

    try {
        const _id = new ObjectId(req.params.id);
        const response = await db.collection("products").findOneAndUpdate(
            { _id },
            { $set: updates },
            { returnDocument: "after" }
        );

        if (!response.value) return res.status(404).send("Produit non trouvé");
        res.send(response.value);
    } catch {
        res.status(400).send("ID invalide");
    }
});

// DELETE /products/:id
app.delete("/products/:id", async (req, res) => {
    try {
        const _id = new ObjectId(req.params.id);
        const response = await db.collection("products").findOneAndDelete({ _id });
        if (!response.value) return res.status(404).send("Produit non trouvé");
        res.send(response.value);
    } catch {
        res.status(400).send("ID invalide");
    }
});

// POST /categories
app.post("/categories", async (req, res) => {
    const result = await CreateCategorySchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result);

    const { name } = result.data;
    const ack = await db.collection("categories").insertOne({ name });
    res.send({ _id: ack.insertedId, name });
});
