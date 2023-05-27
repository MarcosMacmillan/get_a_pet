const mongoose = require("mongoose");

async function main(){
    await mongoose.connect("mongodb://0.0.0.0:27017/getapet");
    console.log("Conectou ao mongoose!");
}

main().catch((err) => console.log("Erro ao conectar com o banco", err));

module.exports = mongoose;
