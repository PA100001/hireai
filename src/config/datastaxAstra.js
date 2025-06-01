const { DataAPIClient } = require("@datastax/astra-db-ts");
const config = require('./index');
const logger = require('./logger');
/**
 * Connects to a DataStax Astra database.
 * This function retrieves the database endpoint and application token from the
 * environment variables `API_ENDPOINT` and `APPLICATION_TOKEN`.
 *
 * @returns An instance of the connected database.
 * @throws Will throw an error if the environment variables
 * `API_ENDPOINT` or `APPLICATION_TOKEN` are not defined.
 */
function connectAstra(){
  const endpoint = config.AstraApiEndpoint
  const token = config.AstraApplicationToken 

  if (!token || !endpoint) {
    throw new Error(
      "Environment variables API_ENDPOINT and APPLICATION_TOKEN must be defined.",
    );
  }

  // Create an instance of the `DataAPIClient` class
  const client = new DataAPIClient(token);

  // Get the database specified by your endpoint and provide the token
  const db = client.db(endpoint);

//   (async () => {
//   const colls = await db.listCollections();
//   console.log('Connected to AstraDB:', colls);
// })();
  return db;
}
// const astraDb = connectAstra();
//   const collection = astraDb.collection("resume"); 
// (async function () {
//   const result = await collection.insertOne({
//     name: "Jane Doe",
//     $vectorize: "Text to vectorize",
//   });
// })();
module.exports = connectAstra
