import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { User } from "../entity/User.entity";
import * as dotenv from "dotenv";
import { verifyMessage } from "../utils/verifyWeb3Message";

dotenv.config();

const SECRET_JWT_KEY = process.env.SECRET_JWT_KEY;

export const signup = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        const userRepository = await AppDataSource.getRepository(User);
        const existingUser = await userRepository.findOneBy({ username: username });
        if (existingUser) {
            return res.status(400).json({ error: "Username already exists" });
        }
        const passwordHash = bcrypt.hashSync(password, 8);
        const newUser = new User();
        newUser.username = username;
        newUser.password = passwordHash;
        await userRepository.save(newUser);
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const web3Signup = async (req: Request, res: Response) => {
    try {
        const { message, ethAddress, signature } = req.body;
        const userRepository = await AppDataSource.getRepository(User);
        const existingUser = await userRepository.findOneBy({ ethAddress: ethAddress });
        if (existingUser) {
            return res.status(400).json({ error: "Ethereum address already in use" });
        }
        verifyMessage({ message: message, address: ethAddress, signature: signature })
        const newUser = new User();
        newUser.ethAddress = ethAddress;
        await userRepository.save(newUser);
        res.status(201).json({ message: "User registered successfully with Ethereum address" });
    } catch (error) {
        console.error("❌ Error ", error)
        res.status(500).json({ error: "Internal Server Error" });
    }
};



export const login = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        const userRepository = await AppDataSource.getRepository(User);
        const existingUser = await userRepository.findOneBy({ username: username });
        if (!existingUser || !bcrypt.compareSync(password, existingUser.password)) {
            return res.status(401).json({ error: "Invalid username or password" });
        }
        const token = jwt.sign({ id: existingUser.id }, SECRET_JWT_KEY, { expiresIn: 86400 });
        res.status(200).json({ auth: true, token });
    } catch (error) {
        console.log("❌ Error ", error)
        res.status(500).json({ error: "Internal Server Error" });
    }
};
