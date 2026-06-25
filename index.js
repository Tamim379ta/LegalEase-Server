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
    // await client.connect();
    const database = client.db("legalease");
    const usersCollection = database.collection("user");
    const lawyersCollection = database.collection("lawyers");
    const bookingsCollection = database.collection("bookings");
    const serviceCollection = database.collection("services");
    const paymentCollection = database.collection("payment")
    const commentCollection = database.collection('comments')
    const sessionCollection = database.collection('session')

    // middleware related api
    const middleware = async (req, res, next) => {
      const authHeader = req.headers?.authorization
      if (!authHeader) {
        return res.status(401).send({
          success: false,
          message: "Unauthorized access"
        });
      }

      const token = authHeader.split(' ')[1]

      if (!token) {
        return res.status(401).send({
          success: false,
          message: "Unauthorized access"
        });
      }

      const query = { token: token }
      const session = await sessionCollection.findOne(query)
      const userId = session.userId
      const userQuery = {
        _id: userId
      }
      const user = await usersCollection.findOne(userQuery)
      req.user = user
      next()
    }
    const verifyClient = (req, res, next) => {
      if (req.user?.role !== 'client') {
        return res.status(403).send({
          success: false,
          message: "Forbidden access"
        });
      }
      next()
    }


    const verifyAdmin = (req, res, next) => {
      if (req.user?.role !== 'admin') {
        return res.status(403).send({
          success: false,
          message: "Forbidden access"
        });
      }
      next()
    }

    const verifyLawyer = (req, res, next) => {
      if (req.user?.role !== 'lawyer') {
        return res.status(403).send({
          success: false,
          message: "Forbidden access"
        });
      }

      next()
    }


    // comment related api
    app.get('/comments', async (req, res) => {
      const result = await commentCollection.find().toArray()
      res.send(result)
    })

    app.post('/comments', middleware, async (req, res) => {
      const comment = req.body
      const commentInfo = {
        ...comment,
        createdAt: new Date()
      }
      const result = await commentCollection.insertOne(commentInfo)
      res.send(result)
    })

    // payment related api 
    app.get('/payments', middleware, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.find().toArray()
      res.send(result)
    })
    app.post('/payments', middleware, async (req, res) => {
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

    app.delete('/services/lawyers/:id', middleware, verifyLawyer, async (req, res) => {
      const { id } = req.params;
      const result = await serviceCollection.deleteOne({
        _id: new ObjectId(id)
      });
      res.send(result)
    });
    app.patch('/services/lawyers/:id', middleware, verifyLawyer, async (req, res) => {
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
    app.get('/services/lawyers',   async (req, res) => {
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
    app.post('/services', middleware, verifyLawyer, async (req, res) => {
      const services = req.body;
      const serviceInfo = {
        ...services,
        createdAt: new Date()
      }
      const result = await serviceCollection.insertOne(serviceInfo)
      res.send(result)

    })



    // booking related api routes
    app.get('/bookings',  async (req, res) => {
      const result = await bookingsCollection.find().toArray()
      res.send(result)
    })

    app.patch('/bookings/:id', middleware, verifyLawyer, async (req, res) => {
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


    app.post('/bookings', middleware, async (req, res) => {
      const booking = req.body;
      const bookingInfo = {
        ...booking,
        createdAt: new Date(),
      }
      const result = await bookingsCollection.insertOne(bookingInfo);
      res.send(result);
    })

    // lawyer related api routes
    app.get('/top-lawyers', async (req, res) => {
      const topLawyers = await bookingsCollection.aggregate([
        { $match: { haringStatus: 'paid' } },
        { $group: { _id: '$lawyerId', totalHires: { $sum: 1 } } },
        { $sort: { totalHires: -1 } },
        { $limit: 3 },
        {
          $lookup: {
            from: 'lawyers',
            localField: '_id',
            foreignField: 'lawyerId',
            as: 'lawyer'
          }
        },
        { $unwind: '$lawyer' },
        {
          $project: {
            _id: 0,
            totalHires: 1,
            name: '$lawyer.name',
            avatar: '$lawyer.photoUrl',
            specialization: '$lawyer.specialization',
            rating: '$lawyer.rating',
            fee: '$lawyer.fee',
          }
        }
      ]).toArray()

      res.json(topLawyers)
    })

    app.get('/featuredlawyers', async (req, res) => {
      const result = await lawyersCollection.find().limit(6).toArray()
      res.send(result);
    })
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

    app.delete('/lawyers/:id', async (req, res) => {
      const { id } = req.params
      const result = await lawyersCollection.deleteOne({
        _id: new ObjectId(id)
      })
      res.send(result)
    })

    app.get('/lawyers', async (req, res) => {
      const { search, category, page = 1, limit = 8 } = req.query

      const filter = {}
      if (category) filter.specialization = category
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { specialization: { $regex: search, $options: 'i' } },
          { bio: { $regex: search, $options: 'i' } },
        ]
      }

      const skip = (Number(page) - 1) * Number(limit)
      const total = await lawyersCollection.countDocuments(filter)
      const lawyers = await lawyersCollection.find(filter).skip(skip).limit(Number(limit)).toArray()

      res.json({ lawyers, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) })
    })

    app.post('/lawyers', async (req, res) => {
      try {
        const lawyer = req.body;
        const lawyerInfo = {
          ...lawyer,
          createdAt: new Date(),
        }
        const result = await lawyersCollection.insertOne(lawyerInfo);
        res.status(201).json(result); // Explicitly send back json status
      } catch (error) {
        console.error("Database insert failed:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
      }
    });

    app.get('/manage-lawyers', middleware, verifyAdmin, async (req, res) => {
      const result = await lawyersCollection.find().toArray()
      res.send(result)
    })

    // user related api routes

    app.delete('/users/:id', async (req, res) => {
      const { id } = req.params
      const result = await usersCollection.deleteOne({
        _id: new ObjectId(id)
      })
      res.send(result)
    })
    app.get('/users', middleware, verifyAdmin, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    })

    app.patch('/users/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        delete updateData._id;
        delete updateData.email;

        const query = ObjectId.isValid(id)
          ? { _id: new ObjectId(id) }
          : { id: id };

        const result = await usersCollection.updateOne(
          query,
          { $set: updateData }
        );

        res.send(result);
      } catch (error) {
        res.status(500).json({ error: "Internal Server Error", details: error.message });
      }
    });


    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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