import { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useWeb3React } from '@web3-react/core';
import { ToastContainer, toast } from 'react-toastify';
import HistoryOrder from '../components/HistoryOrder';
import MarketHistory from '../components/MarketHistory';
import MarketNews from '../components/MarketNews';
import MarketPairs from '../components/MarketPairs';
import MarketTrade from '../components/MarketTrade';
import OrderBook from '../components/OrderBook';
import TradingChart from '../components/TradingChart';
import TradingChartDark from '../components/TradingChartDark';
import { ThemeConsumer } from '../context/ThemeContext';
import {  useWindowSize } from '@react-hook/window-size';
import {fetchOrCreateUser, doc, onSnapshot, query, collection, db, where, fetchSupportedTokens} from '../firebase';
import Pairs from '../pairs'
import { getTokensBalances, sendOrder, removeOrder } from '../helpers/contract';
import displayToast from '../utils/displayToast';



const Exchange = () => {
  const { library, activate, deactivate, active, chainId, account } = useWeb3React();
  const [price, setPrice] = useState(0.001)
  const [amount, setAmount] = useState(0)
  const [volume, setVolume] = useState(0)
  const [buySell, setBuySell] = useState('buy');
  const [createOrderLoading, setCreateOrderLoading ] = useState(false)
  let { pair } = useParams();
  const [activePair, setActivePair] = useState(pair.split('-'));
  let history = useHistory();
  const [user, setUserData] = useState({
    address: 'address',
    [pair.split('-')[0]]: 0,
    [pair.split('-')[1]]: 0,
  });
  const [buyOrders, setBuyOrders] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [sellOrders, setSellOrders] = useState([]);
  const [userTrades, setUserTrades] = useState([]);
  const [width, height] = useWindowSize()
  const breakPoint = 767;

  useEffect(()=> {
    console.log('size', width, height)
  }, [width, height])

  const buyOrdersSocket = () => {
    const q = query(collection(db, `${pair}-BUY`), where("pair", "==", pair));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const orders = [];
      querySnapshot.forEach((doc) => {
          orders.push(doc.data());
      });
      console.log("Current Buy Orders: ", orders);
      let sortedOrders = orders.sort((a, b) => b.price - a.price);
      setBuyOrders(sortedOrders);
    });
  }

  const sellOrdersSocket = () => {
    const q = query(collection(db, `${pair}-SELL`), where("pair", "==", pair));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const orders = [];
      querySnapshot.forEach((doc) => {
          orders.push(doc.data());
      });
      console.log("Current Buy Orders: ", orders);
      let sortedOrders = orders.sort((a, b) => b.price - a.price);
      setSellOrders(sortedOrders);
    });
  }

  const userTradesSocket = () => {
    const q = query(collection(db, `${pair}-TRADES`), where("account", "==", account));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const orders = [];
      querySnapshot.forEach((doc) => {
          orders.push(doc.data());
      });
      console.log("Trade History: ", orders);
      let sortedOrders = orders.sort((a, b) => b.date - a.date);
      setUserTrades(sortedOrders);
    });
  }

  

  useEffect(() => {
    if(!pair) history.push('/trade/BTF-USDT');
    fetchTokensList();
    if(!Pairs.includes(pair)) return history.push('/trade/BTF-USDT')
    buyOrdersSocket();
    sellOrdersSocket();
  }, [])

  useEffect(() => {
    if(price === 0) return;
    if(buySell === 'buy'){
      setAmount(volume / price)
    } else {
      setAmount(volume * price)
    }
  }, [price])

  useEffect(() => {
    if(volume === 0) return;
    if(buySell === 'buy'){
      setAmount(volume/price)
    } else {
      setAmount(volume * price)
    }
  }, [volume])

  useEffect(() => {
    setPrice(0.001);
    setAmount(0);
    setVolume(0);
  }, [buySell])

  useEffect(() => {
    if(tokens.length > 0){
      getBalance();
    }
  }, [tokens, account])

  async function fetchUserData(){
    let user = await fetchOrCreateUser(account);
    if(user){
      console.log(user)
      setUserData(user);
    }
  }

  async function fetchTokensList(){
    let data = await fetchSupportedTokens();
    console.log('dat', data);
    setTokens(data);
  }

  async function getBalance(){
    let res = await getTokensBalances(library, tokens);
    let _userData = {address: account};
    pair.split('-').forEach((_pair) => {
      let dat = tokens.find(item => item.symbol === _pair);
      _userData[_pair] = res[dat.address];
    })
    setUserData(_userData);
  }

  useEffect(() => {
    if(account){
      fetchUserData();
      userTradesSocket();
    }
  }, [account])

  const createOrder = async (orderType) => {
    setCreateOrderLoading(true)

    let orderData = {
      id: Math.random().toString(16).slice(2),
      pair,
      token: buySell === 'buy'? tokens.find(item => item.symbol === activePair[1]).address : tokens.find(item => item.symbol === activePair[0]).address,
      price, 
      volume, 
      buySell, 
      orderType, 
      date: Date.now(),
    }

    let res = await sendOrder(library, orderData);
    setCreateOrderLoading(false)
    displayToast(toast, res);
    getBalance();
  }

  const deleteOrder = async (orderData) => {
    let token = orderData.buySell === 'buy'? tokens.find(item => item.symbol === orderData.pair.split('-')[1]).address : tokens.find(item => item.symbol === orderData.pair.split('-')[0]).address;
    orderData.token = token;
    let res = await removeOrder(library, orderData);
    displayToast(toast, res);

  }

  const autoFillOrder = (price, volume, buySell) => {
    if(buySell === 'buy'){
      setPrice(price);
      setVolume(volume/price)
    } else {
      setPrice(price);
      setVolume(volume*price)
    }
    
  }

  return (
    <>
      <div className="container-fluid mtb15 no-fluid">
        <ThemeConsumer>
          {({data}) => <ToastContainer theme={data.theme} style={{ padding: '10px' }}  /> }
        </ThemeConsumer>
        <div className="row sm-gutters">
          {width > breakPoint &&
            <div className="col-sm-12 col-md-3">
              <MarketTrade 
                activePair={activePair} 
                user={user} 
                price={price} 
                setPrice={setPrice}
                amount={amount}
                setAmount={setAmount}
                volume={volume}
                setVolume={setVolume}
                buySell={buySell}
                setBuySell={setBuySell}
                createOrder={createOrder}
                createOrderLoading={createOrderLoading}
                
                />
              {/* <MarketPairs /> */}
            </div>
          }
          <div className="col-sm-12 col-md-6">
            <ThemeConsumer>
              {({data}) => {
                return <TradingChart theme={data.theme} width={width} pair={activePair} />
              }}
            </ThemeConsumer>
            {width < breakPoint &&
              <div style={{display: 'inline-flex', flexDirection: 'row', flex: 1}}>
                <MarketTrade 
                  activePair={activePair} 
                  user={user} 
                  price={price} 
                  setPrice={setPrice}
                  amount={amount}
                  setAmount={setAmount}
                  volume={volume}
                  setVolume={setVolume}
                  buySell={buySell}
                  setBuySell={setBuySell}
                  createOrder={createOrder}
                  createOrderLoading={createOrderLoading}
                  
                  />

                  <OrderBook buyOrders={buyOrders} sellOrders={sellOrders} pair={pair} autoFillOrder={autoFillOrder} width={width} breakPoint={breakPoint} />
              </div>
            
            }
            <ThemeConsumer>
              {({data}) => {
              return <HistoryOrder orders={[...buyOrders, ...sellOrders]} user={user} theme={data.theme} deleteOrder={deleteOrder} userTrades={userTrades} />
              }}
            </ThemeConsumer>
          </div>
          <div className="col-md-3 mb-5">
            {width > breakPoint && <OrderBook buyOrders={buyOrders} sellOrders={sellOrders} pair={pair} autoFillOrder={autoFillOrder} />}
            {/* <MarketHistory pair={pair} /> */}
          </div>
        </div>
      </div>
    </>
  );
}

export default Exchange
