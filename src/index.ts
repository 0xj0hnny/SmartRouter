import { AlphaRouter, SwapType, V3Route } from "@uniswap/smart-order-router";
import { Token, CurrencyAmount, TradeType, Percent } from "@uniswap/sdk-core";
import JSBI from "jsbi";
import { Address, Hex, encodePacked, parseUnits } from "viem";
import { ethers, getDefaultProvider } from "ethers";

require('dotenv').config();

const WALLET_ADDRESS = process.env.WALLET_ADDRESS as Address
const RPC_URL = process.env.RPC_URL

const web3Provider = getDefaultProvider(RPC_URL)
const chainId = 11155111

const uni = {
  name: 'Uniswap',
  symbol: 'UNI',
  decimals: 18,
  address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' as Address
}

const usdc = {
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 18,
  address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address
}
const inputToken = new Token(chainId, uni.address, uni.decimals, uni.symbol, uni.name);
const outputToken = new Token(chainId, usdc.address, usdc.decimals, usdc.symbol, usdc.name);

const formatV3Route = (poolsFee: number[], tokenPath: Address[]) => {
  let encodePackedType: any = [];
  let encodePackedValue: any = [];

  for (let i = 0; i < poolsFee.length; i++) {
    encodePackedType.push('address')
    encodePackedType.push('uint24')
    encodePackedValue.push(tokenPath[i])
    encodePackedValue.push(poolsFee[i])
  }
  encodePackedType.push('address')
  encodePackedValue.push(tokenPath[tokenPath.length - 1])

  return { encodePackedType, encodePackedValue}
}

async function main() {
  const router = new AlphaRouter({ chainId: chainId, provider: web3Provider});
  const amount = ethers.utils.parseUnits('2', 18)
  const inputAmount = CurrencyAmount.fromRawAmount(inputToken, JSBI.BigInt(amount))
  const res = await router.route(
    inputAmount,
    outputToken,
    TradeType.EXACT_INPUT,
    {
      recipient: WALLET_ADDRESS,
      slippageTolerance: new Percent(5, 100),
      deadline: Math.floor(Date.now()/1000 + 1800),
      type: SwapType.SWAP_ROUTER_02,
    }
  )
  if (res === null) {
    return undefined
  }

  const possibleRoutes = res.route;

  let encodePackedType: any = [];
  let encodePackedValue: any = [];
  let amountIns: bigint[] = [];
  console.log('possible routes: ', possibleRoutes)
  for (const route of possibleRoutes) {
    if (route.route instanceof V3Route) {
      const amountIn = parseUnits(route.amount.toExact().toString(), inputToken.decimals)
      const poolsFee = route.route.pools.map(pool => pool.fee as number)
      const tokenPath = route.tokenPath.map(token => token.address as Address)
      const res = formatV3Route(poolsFee, tokenPath)
      encodePackedType.push(res.encodePackedType)
      encodePackedValue.push(res.encodePackedValue)
      amountIns.push(amountIn)
    } 
  }
  let paths: Hex[] = [];
  for (let i = 0; i < encodePackedType.length; i++) {
    console.log({type: encodePackedType[i], value: encodePackedValue[i]})
    paths.push(encodePacked(encodePackedType[i], encodePackedValue[i]));
  }

  console.log({paths, amountIns})
  // call smart contract to execute the swap based on trade paths
}

main();


