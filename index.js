const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.em0grxr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const newsCollection = client.db("techwaveDB").collection("news");
    const userCollection = client.db("techwaveDB").collection("users");
    const publisherCollection = client
      .db("techwaveDB")
      .collection("publishers");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/admin/allArticle", async (req, res) => {
      const result = await newsCollection.find().toArray();
      res.send(result);
    });

    app.get("/allArticle", async (req, res) => {
      try {
        const query = { status: 'approved' }; // Only fetch approved articles
        const result = await newsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching articles:", error);
        res.status(500).send({ message: "Error fetching articles" });
      }
    });

    //user related api
    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //get user specific data

    app.get("/myArticles", async (req, res) => {
      // console.log(req.query.email)
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await newsCollection.find(query).toArray();
      res.send(result);
    });

    //CREATE data
    app.post("/addArticles", async (req, res) => {
      console.log(req.body);
      const result = await newsCollection.insertOne(req.body);
      res.send(result);
    });

    //DELETE data
    app.delete("/myArticles/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await newsCollection.deleteOne(query);
      res.send(result);
    });
    //Update

    app.get("/allArticle/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await newsCollection.findOne(query);
      res.send(result);
    });

    app.put("/allArticle/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateArticle = req.body;
      const Article = {
        $set: {
          title: updateArticle.title,
          publisher: updateArticle.publisher,
          image: updateArticle.image,
          description: updateArticle.description,
          tag: updateArticle.tag,
          email: updateArticle.email,
        },
      };
      const result = await newsCollection.updateOne(filter, Article, options);
      res.send(result);
    });

    //CREATE publishers data
    app.post("/publishers", async (req, res) => {
      const result = await publisherCollection.insertOne(req.body);
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price) * 100;
      // console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Approve article
    app.post("/allArticle/:id/approve", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status: "approved" },
      };
      const result = await newsCollection.updateOne(filter, updateDoc);
      const updatedArticle = await newsCollection.findOne(filter);
      res.send({ article: updatedArticle });
    });

    // Decline article with reason
    app.post("/allArticle/:id/decline", async (req, res) => {
      const id = req.params.id;
      const { reason } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { status: "declined", declineReason: reason },
      };
      const result = await newsCollection.updateOne(filter, updateDoc);
      const updatedArticle = await newsCollection.findOne(filter);
      res.send({ article: updatedArticle });
    });
// Endpoint to mark an article as premium
app.post("/allArticle/:id/premium", async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: { isPremium: "yes" },
  };
  const result = await newsCollection.updateOne(filter, updateDoc);
  res.send(result);
});

// Middleware to verify if user is subscribed
const verifySubscription = async (req, res, next) => {
  const email = req.decoded.email;
  const user = await userCollection.findOne({ email });

  if (!user || !user.subscription) {
    return res.status(403).send({ message: 'Subscription required' });
  }

  next();
};

// Fetch premium articles for subscribed users
app.get("/premiumArticles", verifyToken, verifySubscription, async (req, res) => {
  try {
    const query = { isPremium: "yes" };
    const result = await newsCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching premium articles:", error);
    res.status(500).send({ message: "Error fetching premium articles" });
  }
});

 
// Endpoint to increment the view count
app.put("/articles/:id/view", async (req, res) => {
  try {
    const { id } = req.params;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $inc: { viewcount: 1 },
    };
    const result = await newsCollection.updateOne(filter, updateDoc);
    res.json(result);
  } catch (error) {
    console.error("Error updating view count:", error);
    res.status(500).json({ error: "Error updating view count" });
  }
});


app.get("/admin/publication-stats", async (req, res) => {
  try {
    const publicationStats = await newsCollection.aggregate([
      {
        $group: {
          _id: "$publisher",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          name: "$_id",
          count: 1,
        },
      },
    ]).toArray();

    res.json(publicationStats);
  } catch (error) {
    console.error("Error fetching publication stats:", error);
    res.status(500).send({ message: "Error fetching publication stats" });
  }
});

 // Endpoint to fetch article view counts
 app.get("/admin/article-viewcounts", async (req, res) => {
  try {
    // Fetch article titles and view counts
    const projection = { title: 1, viewcount: 1, _id: 0 }; // Include only title and viewcount fields
    const articles = await newsCollection.find({}, { projection }).toArray();
    res.json(articles);
  } catch (error) {
    console.error("Error fetching article view counts:", error);
    res.status(500).json({ error: "Error fetching article view counts" });
  }
});


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("news is waving");
});

app.listen(port, () => {
  console.log(`tech Wave is sitting on port ${port}`);
});
