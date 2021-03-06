var express = require('express');
var router = express.Router();
var path = require('path');
var Scanner = require('../logic/scanner/scanner');
var ExplorerUtils = require("../logic/scanner/utils");
var utils = new ExplorerUtils.ExplorerUtils();
var io = null;
var scanner = new Scanner.Scanner(10,1,500);

/* Scanner. */
router.get('/', function(req, res, next) {
    my_addr = '0x0607B0c8cF73D916b3EF1463bb6fB9f19e9D5D98';
    var address = my_addr;
    var direction = "to";
    scanner.one_level_graph({address:address,tx_direction:direction},(nodes,edges)=>{
        res.json({nodes:nodes,edges:edges});
    });
});

module.exports = router;
module.exports = {
    router:router,
    setIO: function(iop){
        io = iop;
        io.on('connection',function(socket){
            console.log('user connected');
            socket.on('disconnect', function(){
                console.log('user disconnected');
            });
            //io.emit('candle_update', {msg:"perfect"});
            socket.on('scan_request',function(origin_address){
                handle_scan_query(origin_address,(res)=>{
                    if(res != null){
                        io.emit('scan_response',{nodes:res.nodes,edges:res.edges});
                    }else{ // no result;
                        io.emit('scan_response',{nodes:null,edges:null});
                    }
                });
            });
        });
    }
}



Number.prototype.noExponents= function(){
    var data= String(this).split(/[eE]/);
    if(data.length== 1) return data[0];

    var  z= '', sign= this<0? '-':'',
        str= data[0].replace('.', ''),
        mag= Number(data[1])+ 1;

    if(mag<0){
        z= sign + '0.';
        while(mag++) z += '0';
        return z + str.replace(/^\-/,'');
    }
    mag -= str.length;
    while(mag--) z += '0';
    return str + z;
}

var address = '0xb42b20ddbEabdC2a288Be7FF847fF94fB48d2579';
my_addr = '0x0607B0c8cF73D916b3EF1463bb6fB9f19e9D5D98';
omg_addr = '0xd26114cd6EE289AccF82350c8d8487fedB8A0C07';
non_token = '0x7c2A856B4AeE9EDbC3A5Fdd1697C0B36bFa2131D';
some_miner = '0xea674fdde714fd979de3edf0f56aa9716b898ec8';
distributer = '0x1151314c646Ce4E0eFD76d1aF4760aE66a9Fe30F';
not_valid_addr = '0xB79335eA0Ba39494CE839613fffBA74279579268';
var bigaddr = '0x75E7F640bf6968b6f32C47a3Cd82C3C2C9dCae68';
//
bittrex = '0xFBb1b73C4f0BDa4f67dcA266ce6Ef42f520fBB98';
poloniex_wallet = '0x32Be343B94f860124dC4fEe278FDCBD38C102D88';
poloniex_coldWallet = '0xb794F5eA0ba39494cE839613fffBA74279579268';
eth_delta = '0x8d12A197cB00D4747a1fe03395095ce2A5CC6819';



function handle_scan_query(address,callback){
    scanner = new Scanner.Scanner(10,1,500);
    scanner.entityDefiner.transaction_explorer.explore_txs_from_addr_paginated(address,1,10,null,(txns)=>{
        sanithize_query(txns,(sanithize_res)=>{
            if(sanithize_res == null){
                console.log("NULL NOT GOOD");
            }else {
                var to_identify = sanithize_res.to_identify;
                var map = sanithize_res.txns_map;
                scanner.identify_all(to_identify,(entities)=>{
                    if(entities.length == to_identify.length && to_identify.length != 0){ // good
                        var edges = [];
                        for(var i=0;i<map.out.length;++i){
                            map.out[i].value =map.out[i].value.noExponents();
                            edges.push(map.out[i]);
                        }
                        for(var i=0;i<map.in.length;++i){
                            map.in[i].value =map.in[i].value.noExponents();
                            edges.push(map.in[i]);
                        }
                        entities.forEach(e=>{
                            e.ether = e.ether.noExponents();
                        });
                        callback({nodes:entities,edges:edges});
                    }else{ // dead
                        callback(null);
                    }
                });
            }
        });
    });
}
var origin_addr = '0x0607B0c8cF73D916b3EF1463bb6fB9f19e9D5D98';
handle_scan_query(origin_addr,(res)=>{
    console.log(res);
});


function getOutAddrs(txns){
    var out_addrs = utils.getAddrsFromTXS(txns,'to');
    return utils.get_unique_address(out_addrs);
}
function getInAddrs(txns){
    var in_addrs = utils.getAddrsFromTXS(txns,'from');
    return utils.get_unique_address(in_addrs);
}

function txPicker(origin,txns,callback){
    var min_out = 1;
    var interesting_out = 3;
    var interesting = [];
    var max_tx = 10;
    txns = utils.sanithize_txns(txns);
    if(txns.length == 0){
        callback(null);
    }
    utils.map_txns(origin,txns,(map)=>{
        var notEmpty = true;
        if(map.empty) // no txns
        {
            notEmpty = false;
            callback(null);
        };
        if(notEmpty){
            var _in_tx = map.in;
            var _out_tx = map.out;
            if(_out_tx.length > min_out && _out_tx.length < interesting_out){ // very little out
                interesting = _out_tx;
            }else if(_out_tx.length == 0){ // no out
                var toTake = Math.min(max_tx,_in_tx.length);
                for(var i=0; i<toTake;++i){
                    interesting.push(_in_tx[i]);
                }
            }else{ // many out
                var toTake = Math.min(max_tx,_out_tx.length);
                for(var i=0;i<toTake;++i){
                    interesting.push(_out_tx[i]);
                }
            }
            utils.map_txns(origin,interesting,(interesting_map)=>{
                if(interesting_map.empty){
                    callback(null);
                }
                callback({origin:origin,map:interesting_map});
            });
        }
    });
}

function sanithize_query(txns,callback){
    txPicker(origin_addr,txns,(picker_res)=>{
        var to_identify = [];
        to_identify.push(origin_addr);
        if(picker_res == null || (picker_res.map.out.length ==0 &&picker_res.map.in.length ==0 ))
        {
            callback(null);
            return null;
        }
        var interesting_txns = picker_res.map;
        var origin = picker_res.address;
        if(interesting_txns.out.length > 0){
            var o = getOutAddrs(interesting_txns.out);
            o.forEach(addr=>{
                to_identify.push(addr);
            });
        }
        if(interesting_txns.in.length > 0){
            var i = getInAddrs(interesting_txns.in);
            i.forEach(addr=>{
                to_identify.push(addr);
            });
        }
        to_identify = utils.get_unique_address(to_identify);
        callback({to_identify:to_identify, txns_map : interesting_txns});
    });
}