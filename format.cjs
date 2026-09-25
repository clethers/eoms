const rawData = `ABB 40A S/N:BLY1200655-Breaker
ABB Bolt on Circuit Breaker TQC2440WL 40A 2P
ABB S202-C2 400V 6000 3 2B
ANDELI ADB3LE-63 6000A 230V - 50/60HZ
Atlanta PVC Solvent cement C#0032670
Bass bar 
BM 125SN 125AT, 3P, 30KAIC@ 230V
Bottom Knot  3/8
Breaker MCBB 
BREAKER SLEMENS 2W/240 3VM 3VM1010- 3ED32-0AA0
BUTANE GAS Johnson Electic 250 UN 2037
CABLE LUG  ELA LUG0503 SCHNEIDER ELECTRIC . 13 PER PACK
CAUTION TAPE 
CHNT  DB-2F808044 BC#624
Circuit Breaker Plug in 10LA 120/240 V 40A
CLAMP 1/2 2HOLE 
CLAMP 3/4  1HOLE 
CLAMP 3/4  2HOLE 
CONDUIT THREADED  TYPE 3/4" T
CONDUIT THREADED LR TYPE 3/4" LR
Connection End B/(M41) 2.0 # 236120
Connector 1/2" EMT SET SCREW
COVER 4 x8x8
CTE AS2500/5A 5VA-CL05 50/60 HZ
CTE YL PE CABLE APUT-36C1X1-T
D 14mm BLUE
D 14mm YELLOW
D 14mm YELLOW
D 14mmGREEN
D 30m BLUE
D 30m RED
DISTRIBUTION BOX MCGILL 6WAYS
DURAFLEX 5.5 150/roll GREEN
DURAFLEX 8.0 150 m/roll RED
DURAFLEX 8.0 150 m/roll YELLOW
DURAFLEX 8.00mm GREEN
ELBOW 1 1/2" 
ELBOW 1"
ELECTRIC METER  51952734
ELECTRIC METER SAFARI
Electrical Tape 
EMT PIPE 3/4 " MCGILL
EMT SET SCREW COUPLING  1/2" MCGILL 
EMT SET SCREW COUPLING  3/4" MCGILL
EMTSET SCRE CONNECTOR 3/4"  MCGILL
Fiber Glass Mesh Tape
FULL TRADE 3/8"
GE Circuit Breaker Plug In 7QL244 Bolt on  40 A 2P
GE Circuit Breaker TQC3440 WL 30A 3P
GRINDING DESK (PANGHASA)
GROUNDING ROD
HIGH GRADE LENGTHTEN ALLOY HOLE SAW W3722-20 20MM
IMC COUPLING 1/2"
IMC Coupling Connector MCGILL
IMC PIPE 1"  MCGILL
IMC PIPE 1/2"  MCGILL
IMC PIPE 3/4"  MCGILL
JUNCTION BOX 
JUNCTION BOX  COVER
JUNON Distribution Box 6ways 230v/400v, 63a/p40  model #DX10-A06SWB
KOTEN CB 40A 
KOTEN CB K63NC 32 220/380V10AA  / EC60898
LIQUID TIGHT CONNECTOR  1 1/4" 
LL 1/2  Thread Conduit Bodies Series w/cover MCGILL
LQT 1/2" HOSE
LQT 3/4" HOSE
LQT Connector 1/2
LQT Connector 3/4 MCGILL
LQT Connector 3/4"
LQT STRAIGHT CONNECTOR 3/4"
MCB 20AT, 2P, 230V RPCH2P
MCCB 80AT, 3P, 400V BM100HBN
MCCB14 2PAC460V BF52a20A
MCGILL 4WAYS DB 200X 130X 100mm 
MCGILL Waterproof  Distribution Box w/ DIN RAIL&screws 230-273-110m MGWDB-12
MEGA HIMEL Breaker HDB9LEN63A26405 2P6RA 40A 
Metalic Conduit 3/4"
METASOL MCCB ABN103C A3P
MICA TUBE 1/2 
MINIATURE CIRCUIT BREAKER MCB BHA3LC20 IP20A 6KAAC240V SHIHLIN
Pako 3"
PANASONIC CB / EC60898-1 415V C40 BB122402CWTB
PD 1.25m WHITE
PD 100m YELLOW 
PD 125m BLUE
PD 125m RED
PD 125mYELLOW
PD 22 BLUE
PD 22 RED
PD 22 YELLOW
PD 3.5 BLUE
PD 3.5 YELLOW 
PD 30m  WHITE
PD 30m BLUE
PD 30m RED
PD 30m YELLOW 
PD 38mm WHITE
PD 5.5 BLUE
PD 5.5 RED
PD 5.5 YELLOW
PD 8.0 RED
PD 8.0 YELLOW
PF 38mm WHITE
PLASTIC MOLDING  3/4 GRAY
PLASTIC MOLDING  3/4 WHITE 
POWER FLEX 8.0m RED
POWERFLEX  14mm BLUE
POWERFLEX  14mm RED
POWERFLEX  5.5 WHITE
POWERFLEX  5.5 YELLOW
POWERFLEX  8.0 GREEN
POWERFLEX 5.5 BLUE
POWERFLEX 5.5m RED
Pullbox  6"x8"x8" GA # 18
PVC Pipe 1/2" ATLANTA
PVC Pipe 3/4" ATLANTA
"RCBO 2P 40at BHL B32 40AT 2P"
RCBO SHIHLIN BHL 33 3P 400/415V C40
RESIDUAL CURRENT CIRCUIT BREAKER WITH OVER CURRENT PROTECTION BHL33C 32AT, 3P, 400V
SAMSUNG 60 inside 10W DL120
Screw  124000014178
SELHOT SHOW-6 WATERPROOF DB 1P66
SHIHLIN BML32 230/240V C40 G
SHIHLIN MCCB BM100-ABN 4P 80A w/accessories
SHIHLIN PHL 33   400LY15V-C32
Smoke Test
SQUARE BOX 
SQUARE BOX COVER
TOX SCREW 8"
UNIT STRUT CLAMP 3/4" MCGILL
UTILITY BOX 
YL /  "LB" 1/2"  Straight Threaded Conduit Bodies Series w/coverMCGIL
YL /  "LB" 1/2" Threaded Conduit Bodies Series w/cover MCGIL   
YL /  "LB" 3/4"  Straight Threaded Conduit Bodies Series w/cover MCGIL 
YOKOHAMA Transformer 380-400-440x
BM250CN3P125A: SHIHLIN B250-CN 3P125A MCCB INDUSTRIAL
SHTBM250SNAC220V: SHIHLIN SHUNT TRIP FOR BM250SN/HN`;

const items = rawData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
let out = 'const catalog = [\n';

items.forEach((item, i) => {
    let cat = 'hardware';
    if (item.toLowerCase().includes('breaker') || item.toLowerCase().includes('mccb') || item.toLowerCase().includes('mcb') || item.toLowerCase().includes('rcbo')) cat = 'breakers';
    else if (item.toLowerCase().includes('conduit') || item.toLowerCase().includes('pipe') || item.toLowerCase().includes('lqt') || item.toLowerCase().includes('emt') || item.toLowerCase().includes('imc')) cat = 'conduits';
    else if (item.toLowerCase().includes('wire') || item.toLowerCase().includes('cable') || item.toLowerCase().includes('flex') || item.toLowerCase().includes('pd ')) cat = 'wires';
    else if (item.toLowerCase().includes('box') || item.toLowerCase().includes('db')) cat = 'enclosures';
    else if (item.toLowerCase().includes('clamp') || item.toLowerCase().includes('connector') || item.toLowerCase().includes('coupling')) cat = 'fittings';

    let key = 'item-' + i;
    // random stock between 10 and 300
    let stock = Math.floor(Math.random() * 290) + 10;
    // 5% chance of being critically low stock to show on dashboard
    if (Math.random() < 0.05) stock = Math.floor(Math.random() * 10) + 1;

    out += `    { category: '${cat}', itemKey: '${key}', itemName: ${JSON.stringify(item)}, details: {}, currentStock: ${stock}, unitPrice: ${Math.floor(Math.random()*1500)+50} },\n`;
});

out += '];\n';
const fs = require('fs');
fs.writeFileSync('catalog-gen.js', out);
console.log('done');
