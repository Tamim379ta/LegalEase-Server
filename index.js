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
    const lawyersCollection = database.collection("lawyers");
    const bookingsCollection = database.collection("bookings");



    // booking related api routes
    app.patch('/bookings/:id', async (req, res) => {
      const { id } = req.params;
      const { haringStatus } = req.body;

      const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { haringStatus } }
      );

      res.send(result);
    });

    app.get("/bookings/:id", async (req, res) => {
      const { id } = req.params;

      const query = {
        $or: [
          { lawyerId: id },
          { userId: id },
        ],
      };
      const booking = await bookingsCollection.find(query).toArray();

      res.send(booking);
    });


    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      const bookingInfo = {
        ...booking,
        createdAt: new Date(),
      }
      const result = await bookingsCollection.insertOne(bookingInfo);
      res.send(result);
    })

    // lawyer related api routes
    app.get('/lawyers/:id', async (req, res) => {
      const { id } = req.params;
      const query = {
        $or: [
          { _id: new ObjectId(id) },
          { lawyerId: id },
        ],
      };
      const lawyer = await lawyersCollection.findOne(query);
      res.send(lawyer);
    })

    app.get('/lawyers', async (req, res) => {
      const lawyers = await lawyersCollection.find().toArray();
      res.send(lawyers);
    })


    app.post('/lawyers', async (req, res) => {
      const lawyer = req.body;
      const lawyerInfo = {
        ...lawyer,
        createdAt: new Date(),
      }
      const result = await lawyersCollection.insertOne(lawyerInfo);
      res.send(result);
    })

    // user related api routes
    app.get('/users', async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    })

    app.patch('/users/:id', async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;

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