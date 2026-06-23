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
    const serviceCollection = database.collection("services");
    const paymentCollection = database.collection("payment")


    // payment related api 
    app.get('/payments', async (req, res) => {
      const result = await paymentCollection.find().toArray()
      res.send(result)
    })
    app.post('/payments', async (req, res) => {
      const { lawyerId, clientId, hiringId, amount, currency, stripeSessionId, status } = req.body

      const existing = await paymentCollection.findOne({ stripeSessionId })
      if (existing) {
        return res.send({ message: 'Already saved' })
      }

      await paymentCollection.insertOne({
        lawyerId,
        clientId,
        hiringId,
        amount,
        currency,
        stripeSessionId,
        status,
        createdAt: new Date(),
      })

      await bookingsCollection.updateOne(
        { _id: new ObjectId(hiringId) },
        { $set: { haringStatus: 'paid' } }
      )

      res.send({ message: 'Payment saved' })
    })
    // lawyer services related api 

    app.delete('/services/lawyers/:id', async (req, res) => {
      const { id } = req.params;
      const result = await serviceCollection.deleteOne({
        _id: new ObjectId(id)
      });
      res.send(result)
    });
    app.patch('/services/lawyers/:id', async (req, res) => {
      const { id } = req.params;
      const { specialization, fee, status } = req.body;

      const result = await serviceCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            specialization,
            fee: Number(fee),
            status
          }
        }
      );
      res.send(result)
    });
    app.get('/services/lawyers', async (req, res) => {
      const result = await serviceCollection.find().toArray()
      res.send(result);
    })
    app.get('/services/lawyers/:id', async (req, res) => {
      const { id } = req.params;
      const query = {
        lawyerId: id
      }
      const services = await serviceCollection.find(query).toArray();
      res.send(services);

    });
    app.post('/services', async (req, res) => {
      const services = req.body;
      const serviceInfo = {
        ...services,
        createdAt: new Date()
      }
      const result = await serviceCollection.insertOne(serviceInfo)
      res.send(result)

    })



    // booking related api routes
    app.get('/bookings', async (req, res) => {
     const result = await bookingsCollection.find().toArray()
     res.send(result)
    })

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
    app.patch('/lawyers/:id', async (req, res) => {
      const { id } = req.params;
      const { name, specialization, bio, fee, status, photoUrl } = req.body;
      const result = await lawyersCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            name,
            specialization,
            bio,
            fee: Number(fee),
            status,
            photoUrl
          }
        }
      );
      res.send(result)
    });
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

    app.delete('/users/:id', async (req, res) => {
      const { id } = req.params
      const result = await usersCollection.deleteOne({
        _id: new ObjectId(id)
      })
      res.send(result)
    })
    app.get('/users', async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    })

    app.patch('/users/:id', async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;

      delete updateData._id;
      delete updateData.email;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
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