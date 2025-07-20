const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Environment Variables
const { PRIVATE_KEY, RPC_URL } = process.env;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0xA04A11856eAA0BCe02fc6A698Cd4e2d9f7067F02";

// Token ABI (permit), and MetaArbExecutor ABI
const ERC20_ABI = [
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
];

const EXECUTOR_ABI = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "ECDSAInvalidSignature",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "length",
				"type": "uint256"
			}
		],
		"name": "ECDSAInvalidSignatureLength",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "s",
				"type": "bytes32"
			}
		],
		"name": "ECDSAInvalidSignatureS",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "DOMAIN_SEPARATOR",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "META_TX_TYPEHASH",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "emergencyWithdraw",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "deadline",
				"type": "uint256"
			},
			{
				"internalType": "bytes",
				"name": "signature",
				"type": "bytes"
			}
		],
		"name": "executeMetaTx",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "nonces",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

// Setup provider, signer, and contract
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const executor = new ethers.Contract(CONTRACT_ADDRESS, EXECUTOR_ABI, signer);

// Endpoint: Accepts signed permit & metaTx and executes both
app.post("/permit", async (req, res) => {
  try {
    const {
      owner,
      spender,
      value,
      deadline,
      v,
      r,
      s,
      token,              // token address
      metaSignature       // optional: if you want to relay after permit
    } = req.body;

    const tokenContract = new ethers.Contract(token, ERC20_ABI, signer);

    console.log("📥 Received signed permit, sending...");

    const tx = await tokenContract.permit(owner, spender, value, deadline, v, r, s);
    await tx.wait();

    console.log("✅ Permit executed. Tokens now pullable by contract.");

    // Optionally, trigger metaTx immediately after permit (optional)
    if (metaSignature) {
      console.log("➡️ Executing meta transaction...");

      const tx2 = await executor.executeMetaTx(owner, token, value, deadline, metaSignature);
      const receipt = await tx2.wait();

      res.json({
        status: "success",
        txHash: receipt.transactionHash,
        message: "Permit and MetaTx executed ✅"
      });
    } else {
      res.json({
        status: "success",
        message: "Permit executed successfully ✅"
      });
    }
  } catch (err) {
    console.error("❌ Error executing permit/metaTx:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("MetaArb Relayer is Running ✅");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Relayer server running on port ${PORT}`);
});
