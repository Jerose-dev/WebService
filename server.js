const soap = require("soap");
const fs = require("node:fs");
const http = require("http");

const postgres = require("postgres");

const sql = postgres({ db: "MythicGames", user: "postgres", password: "$$Elea05032013$$", port: 5432 });

// Define the service implementation
const service = {
    ProductsService: {
        ProductsPort: {
            CreateProduct: async function ({ name, about, price }, callback) {
                if (!name || !about || !price) {
                    throw {
                        Fault: {
                            Code: {
                                Value: "soap:Sender",
                                Subcode: { value: "rpc:BadArguments" },
                            },
                            Reason: { Text: "Processing Error" },
                            statusCode: 400,
                        },
                    };
                }
                const product = await sql`
                    INSERT INTO products (name, about, price)
                    VALUES (${name}, ${about}, ${price})
                        RETURNING *
                `;

                callback(product[0]);
            },

            GetProduct: async function (_, callback) {
                try {
                    const products = await sql`
                        SELECT * FROM products
                    `;
                    callback(products);
                } catch (error) {
                    throw {
                        Fault: {
                            Code: {
                                Value: "soap:Server",
                                Subcode: { value: "rpc:InternalError" },
                            },
                            Reason: { Text: "Server processing error" },
                            statusCode: 500,
                        },
                    };
                }
            },

            PatchProduct: async function (args, callback) {
                const { id } = args;

                if (!id) {
                    throw {
                        Fault: {
                            Code: {
                                Value: "soap:Sender",
                                Subcode: { value: "rpc:MissingId" },
                            },
                            Reason: { Text: "Product ID is required for update" },
                            statusCode: 400,
                        },
                    };
                }

                // Exclure l'id des champs à modifier
                const fieldsToUpdate = Object.keys(args).filter((key) => key !== 'id');

                if (fieldsToUpdate.length === 0) {
                    throw {
                        Fault: {
                            Code: {
                                Value: "soap:Sender",
                                Subcode: { value: "rpc:NoUpdateFields" },
                            },
                            Reason: { Text: "No fields provided for update" },
                            statusCode: 400,
                        },
                    };
                }

                // Générer les clauses "field = $index"
                const setClauses = fieldsToUpdate.map((field, index) => `${field} = $${index + 2}`).join(', ');
                const values = fieldsToUpdate.map((field) => args[field]);

                const query = `
        UPDATE products
        SET ${setClauses}
        WHERE id = $1
        RETURNING *
    `;

                const result = await sql.unsafe(query, [id, ...values]);

                if (result.length === 0) {
                    throw {
                        Fault: {
                            Code: {
                                Value: "soap:Sender",
                                Subcode: { value: "rpc:NotFound" },
                            },
                            Reason: { Text: "Product not found" },
                            statusCode: 404,
                        },
                    };
                }

                callback(result[0]);
            },

            DeleteProduct: async function ({ id }, callback) {
                if (!id) {
                    throw {
                        Fault: {
                            Code: {
                                Value: "soap:Sender",
                                Subcode: { value: "rpc:MissingId" },
                            },
                            Reason: { Text: "Product ID is required for deletion" },
                            statusCode: 400,
                        },
                    };
                }

                const deleted = await sql`
                    DELETE FROM products
                    WHERE id = ${id}
                    RETURNING *
                `;

                if (deleted.length === 0) {
                    throw {
                        Fault: {
                            Code: {
                                Value: "soap:Sender",
                                Subcode: { value: "rpc:NotFound" },
                            },
                            Reason: { Text: "Product not found" },
                            statusCode: 404,
                        },
                    };
                }

                callback({ success: true, deleted: deleted[0] });
            }
        },
    },
};



// http server example
const server = http.createServer(function (request, response) {
    response.end("404: Not Found: " + request.url);
});

server.listen(8000);

// Create the SOAP server
const xml = fs.readFileSync("productsService.wsdl", "utf8");
soap.listen(server, "/products", service, xml, function () {
    console.log("SOAP server running at http://localhost:8000/products?wsdl");
});