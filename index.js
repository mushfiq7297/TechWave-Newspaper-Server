const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

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
     

    app.get("/allArticle", async (req, res) => {
      const result = await newsCollection.find().toArray();
      res.send(result);
    });


    //user related api
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    app.post('/users', async(req,res) =>{
      const user = req.body
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user)
      res.send(result);
    })

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
