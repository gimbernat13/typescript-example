import { Post } from "./entity/Post";
import { File } from "./entity/File";
import { User } from "./entity/User";


import { AppDataSource } from "./data-source";
import { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as express from "express";
import * as fs from "fs";
import * as path from "path";

const { Web3Storage, getFilesFromPath } = require('web3.storage');


dotenv.config();

const SECRET_JWT_KEY = process.env.SECRET_JWT_KEY || "myFallbackSecretKey";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? bcrypt.hashSync(process.env.ADMIN_PASSWORD, 8) : "";
const WEB3_STORAGE_TOKEN = process.env.WEB3_STORAGE_TOKEN;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error("Missing essential environment variables");
  process.exit(1);
}

AppDataSource.initialize()
  .then(() => {
    console.log("✅ Initialized data source");
  })
  .catch((error) => {
    console.error("❌ Could not initialize data source:", error);
    process.exit(1);
  });

const app = express();
app.use(express.json());


const authenticateJWT = (req: Request, res: Response, next: express.NextFunction) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (token == null) return res.sendStatus(401);  // if there isn't any token

  jwt.verify(token, SECRET_JWT_KEY as string, (err: any, user: any) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();  // pass the execution off to whatever request the client intended
  });
};


app.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, ADMIN_PASSWORD)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const token = jwt.sign({ id: ADMIN_USERNAME }, SECRET_JWT_KEY, { expiresIn: 86400 });
    res.status(200).json({ auth: true, token });
  } catch (error) {
    console.error("Error in /login:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/posts", async (req: Request, res: Response) => {
  try {
    const posts = await AppDataSource.getRepository(Post).find();
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error in /posts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/posts", authenticateJWT, async function (req: Request, res: Response) {
  const newPost = new Post()
  newPost.title = req.body.title
  newPost.text = req.body.text
  console.log("🔖 NewPost is... ", newPost);

  try {
    const post = await AppDataSource.getRepository(Post).create(req.body);
    const results = await AppDataSource.getRepository(Post).save(post);
    return res.send(results);
  } catch (error) {
    console.log("Error in /posts POST:", error);
    return res.status(500).send("Internal Server Error");
  }
});

app.post("/upload", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const token = WEB3_STORAGE_TOKEN; // Get this securely
    const storage = new Web3Storage({ token });
    
    // Receive raw HTML content from the frontend
    const htmlContent = req.body.htmlContent;

    // Convert raw HTML content to an HTML file
    const tempFilePath = path.join(__dirname, "temp.html");
    fs.writeFileSync(tempFilePath, htmlContent);

    // Prepare the file for uploading to IPFS
    const files = await getFilesFromPath(tempFilePath);

    console.log(`Uploading HTML file to IPFS`);
    const cid = await storage.put(files);
    console.log('Content added with CID:', cid);

    // Clean up the temp file after uploading
    fs.unlinkSync(tempFilePath);

    // Save the CID and user ID to the database
    const newFile = new File();
    newFile.cid = cid;

    const userRepo = await AppDataSource.getRepository(User);
    const user = await userRepo.findOne(req.user.id); // Assuming 'id' exists on req.user

    if (user) {
      newFile.user = user;
    }

    const fileRepo = await AppDataSource.getRepository(File);
    await fileRepo.save(newFile);

    res.status(200).json({ cid });
  } catch (error) {
    console.error("Error in /upload:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(8000, () => {
  console.log("Server running on port 8000");
});



