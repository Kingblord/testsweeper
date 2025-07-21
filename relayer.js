// relayer.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

// === CONFIG ===
const RPC_URL = process.env.RPC_URL; // BSC node URL
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Relayer account (has gas)
const EXECUTOR_ADDRESS = process.env.EXECUTOR_ADDRESS; // MetaArbExecutor deployed

// EIP-712 domain/type for meta-tx signature
const domain = {
  name: 'MetaArbExecutor',
  version: '1',
  chainId: 56,
  verifyingContract: EXECUTOR_ADDRESS
};
const types = {
  MetaTx: [
    { name: 'token', type: 'address' },
    { name: 'from', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
};

const executorAbi = [
  'function executeMetaTx(address token, address from, uint256 amount, uint256 nonce, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external'
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const executor = new ethers.Contract(EXECUTOR_ADDRESS, executorAbi, signer);

app.post('/execute', async (req, res) => {
  try {
    const { token, from, amount, nonce, deadline, signature } = req.body;
    if (!token || !from || !amount || !nonce || !deadline || !signature) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const sig = ethers.Signature.from(signature);
    const tx = await executor.executeMetaTx(
      token, from, amount, nonce, deadline, sig.v, sig.r, sig.s
    );
    const receipt = await tx.wait();

    res.json({ status: 'ok', txHash: receipt.transactionHash });
  } catch (err) {
    res.status(500).json({ error: err.reason || err.message });
  }
});

app.listen(3000, () => console.log('Relayer running on port 3000'));
