const soap = require("soap");

soap.createClient("http://localhost:8000/products?wsdl", {}, function (err, client) {
    if (err) {
        console.error("Error creating SOAP client:", err);
        return;
    }

    // CREATE
    // client.CreateProduct({ name: "Test", about: "Test", price: "10" }, function (err, result) {
    //     if (err) {
    //         console.error("Error making SOAP request:", err.response?.status, err.response?.statusText, err.body);
    //         return;
    //     }
    //     console.log("Create Result:", result);
    // });

    // GET
    // client.GetProduct({}, function (err, result) {
    //     if (err) {
    //         console.error("Error making SOAP request:", err.response?.status, err.response?.statusText, err.body);
    //         return;
    //     }
    //     console.log("Get Result:", result);
    // });

    // UPDATE
    // Met à jour un ou plusieurs champs d’un produit existant (ex: produit ID 1)
    client.PatchProduct({ id: 3, name: "Test25", price: "150" }, function (err, result) {
        if (err) {
            console.error("Error making SOAP request:", err.response?.status, err.response?.statusText, err.body);
            return;
        }
        console.log("Update Result:", result);
    });

    // DELETE
    // Supprime un produit existant (ex: produit ID 1)
    // client.DeleteProduct({ id: 5 }, function (err, result) {
    //     if (err) {
    //         console.error("Error making SOAP request:", err.response?.status, err.response?.statusText, err.body);
    //         return;
    //     }
    //     console.log("Delete Result:", result);
    // });
});
