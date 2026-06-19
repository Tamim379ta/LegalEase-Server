const express = require('express');
const app = express()
const cors = require('cors')
const dotenv = require('dotenv');
dotenv.config()
const port = 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI;

app.use(express.json());
app.use(cors());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    await client.connect();
    const database = client.db("legalease");
    const usersCollection = database.collection("user");

    app.get('/users', async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    })

    app.patch('/users/:id', async (req, res) => {
      const { id } = req.params; 
      const { role } = req.body;

      console.log(id);

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );

      res.send(result);
    });
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})