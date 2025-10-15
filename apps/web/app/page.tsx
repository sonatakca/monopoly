'use client'

import { useEffect, useLayoutEffect, useMemo, useState, useRef, Suspense, useCallback } from 'react'
// import { socket } from '../lib/socket'
import { useSocketWorker } from './hooks/useSocketWorker';
import type { ServerEvent, ClientEvent, RoomState, Player } from '@shared/types'
import Board3D, { type CameraPreset, type PlacementOverrides } from './components/Board3D'
import PropertyCard from './components/PropertyCard'
import DiceRoll from './components/DiceRoll'
import DiceSlots from './components/DiceSlots'
import ActionCardModal3D from './components/ActionCardModal3D'

import AuctionOverlay from './components/AuctionOverlay'
import { DevFPS } from './components/dev/DevFeatures'
import PlacementPanel from './components/dev/PlacementPanel'
import LoadingOverlay from './components/LoadingOverlay'
import { ensureDevFlagsAPI, getDevFlag } from './components/dev/devFlags'
import RoomsList from './components/RoomsList'
import { PLAYER_DOTS } from './components/playerColors'
import GameButtons, { MetallicActionButton } from './components/GameButtons'
import { BanknoteArrowUp, Expand, Shrink } from 'lucide-react'
import { RiAuctionLine } from "react-icons/ri";
import MoneyFx, { type MoneyFxHandle, type MoneyTransfer } from './components/MoneyFx'
import board from '@shared/board.tr.json'
import './preload-assets'
import { Autour_One } from 'next/font/google'
import Image from 'next/image'
import GoToGameButton from './components/GoToGameButton'

import TradeOverlay from './components/TradeOverlay';






const NAME_KEY = 'monopoly:name'
const PLACE_KEY = 'monopoly:placements'

/** === BAKED-IN PERMANENT PLACEMENTS (your JSON) === */
/* const PERMA_PLACEMENTS_RAW: Record<string, [number, number][]> = {
  "0": [
    [3.7955619420060525, 4.742363795799713],
    [3.861675551892426, 4.484040801349066],
    [3.9141432940922125, 4.196865075256969],
    [3.9912632873151064, 3.8108948394827715],
    [4.535694901092359, 3.8025600294602926],
    [4.468649589683065, 4.118666299423467],
    [4.4256036084842805, 4.439716602449801],
    [4.366961912326928, 4.700194984725087]
  ],
  "1": [
    [3.4215735550342425, 4.721322642786646],
    [3.4442996620600494, 4.520694156222625],
    [3.462901689209549, 4.304473261301361],
    [3.4668851595912136, 4.055287815442947],
    [3.11179548497995, 4.06325001936588],
    [3.076588720235135, 4.266288902190226],
    [3.036279796671392, 4.484040801349065],
    [3.0213699109589465, 4.636287612513279]
  ],
  "2": [
    [2.591189213287688, 4.671889069449081],
    [2.610474070903269, 4.387530195048207],
    [2.621336861155529, 4.1265373032266055],
    [2.6229271112234978, 3.7942127921821163],
    [2.3009506670703113, 3.794212792182116],
    [2.232708500112101, 4.1265373032266055],
    [2.2073042557683693, 4.395017150202467],
    [2.1716097481778105, 4.636287612513279]
  ],
  "3": [
    [1.8020602295631742, 4.714289513304953],
    [1.8053458390989066, 4.527994452544245],
    [1.8314983321451517, 4.289232306960811],
    [1.8228293622507863, 4.071201373533244],
    [1.4322231204254348, 4.071201373533244],
    [1.4186604159071874, 4.289232306960811],
    [1.4129879398226468, 4.4987327364051986],
    [1.3921430875291687, 4.70724739706024]
  ],
  "4": [
    [0.9462222925137045, 4.693132900768115],
    [0.9600643342392126, 4.461925312609534],
    [0.9967998516148388, 4.142244479227927],
// Provided area corners per tile (tl,tr,br,bl), plus 10v/10j
const AREA_CORNERS: Record<string, [number, number][]> = {
  "0": [[4.900981331670904,4.905835440913878],[3.6004177187369453,4.888387493823327],[3.627112116385472,3.61450636794482],[4.8929478421669685,3.614506367944818]],
  "1": [[3.585869744478287,4.888387493823327],[2.791552006645078,4.914559389334794],[2.8180517749321523,3.9024696407401693],[3.5862484430784822,3.9286472152834664]],
  "2": [[2.782831368114838,4.888387493823328],[2.00597902576324,4.888387493823328],[1.997530314780602,3.6145063679448204],[2.7919513564779557,3.6145063679448204]],
  "3": [[1.9972503477592891,4.888387493823329],[1.2029406493997896,4.888387493823328],[1.2117996169211547,3.9111955156762974],[1.997465109970463,3.9111955156762974]],
  "4": [[1.1942119713958388,4.888387493823328],[0.40863055876452065,4.897111475743407],[0.399958329828781,3.614506367944821],[1.2031092730832484,3.6145063679448204]],
  "5": [[0.39990227303633946,4.888387493823329],[-0.39440666808082464,4.90583544091388],[-0.3944627118685719,3.6145063679448204],[0.39122842827166815,3.6145063679448204]],
  "6": [[-0.4118643859508927,4.897111475743407],[-1.1974458016866092,4.888387493823329],[-1.1888472279504092,3.893743749048918],[-0.40317983920947315,3.902469640740169]],
  "7": [[-1.20617447969056,4.888387493823328],[-2.0092109272585597,4.897111475743406],[-2.0094964292745554,3.6057799233080323],[-1.2063423984573556,3.6232327958248933]],
  "8": [[-2.01794153405796,4.888387493823328],[-2.8035198631000764,4.897111475743406],[-2.8038240142197557,3.911195515676297],[-2.0094269753707357,3.9199213738573855]],
  "9": [[-2.8122512324174593,4.888387493823328],[-3.6065574685662263,4.897111475743406],[-3.5982225784393775,3.90246964074017],[-2.812556331087762,3.9024696407401698]],
  "11": [[-4.888533993222223,3.5947064040461774],[-4.888533993313068,2.8003728447850382],[-3.920019927243641,2.80938760007037],[-3.9112936794378435,3.595075446694219]],
  "12": [[-4.888533993313068,2.8003728447850382],[-4.897258449673866,2.006037446914581],[-3.6145917384536332,2.0063077586565985],[-3.614591738363775,2.7920175171463564]],
  "13": [[-4.897258449673866,2.006037446914581],[-4.89725844976571,1.2029756834787106],[-3.90256741599691,1.2118312341020305],[-3.9112936796205515,1.9975153947480822]],
  "14": [[-4.897258449766708,1.1942467512674508],[-4.8885339935876,0.39991428657829964],[-3.9112936798032587,0.3999553428019448],[-3.9112936797104076,1.2118301232991628]],
  "15": [[-4.8885339935876,0.39991428657829964],[-4.888533993678446,-0.39441927268283894],[-3.6233185303851605,-0.3944716973531555],[-3.6145917386383446,0.3912376995387652]],
  "16": [[-4.888533993678446,-0.39441927268283894],[-4.8885339937692915,-1.1887528319439784],[-3.911293679984968,-1.1888748727947598],[-3.911293679896111,-0.411919437695272]],
  "17": [[-4.88853399377029,-1.1974817721556388],[-4.888533993862134,-2.000544271628439],[-3.614591738911914,-2.000812009641162],[-3.614591738820059,-1.1976420342960772]],
  "18": [[-4.8885339938641295,-2.0180021520517597],[-4.888533993953977,-2.8036067711012387],[-3.9200199278846144,-2.795162198952867],[-3.9025674163663195,-2.01821117594975]],
  "19": [[-4.888533993954975,-2.8123357113128993],[-4.888533994046818,-3.6153982107857],[-3.9112936802605276,-3.5983097052381137],[-3.920019927885613,-2.803892027300256]],
  "20": [[-4.8953242878247085,-4.8885281986933276],[-3.6034477204311974,-4.871080768217813],[-3.59519177470407,-3.614587482245314],[-4.89597793100574,-3.6145859416297297]],
  "21": [[-3.612179977014379,-4.862356253617152],[-2.800378635761922,-4.888530679889723],[-2.818124644936313,-3.911290344024288],[-3.5950800804106207,-3.9112894238194964]],
  "22": [[-2.7916522438600935,-4.879806217951927],[-2.0060487325817977,-4.87108266013353],[-2.0063138689289883,-3.6058625564051234],[-2.7920192500084613,-3.6233152251656655]],
  "23": [[-1.9973197763640418,-4.8710826704718695],[-1.1942536358471199,-4.888532582140292],[-1.2031038270488297,-3.9200185045352187],[-1.9975200276937846,-3.9112913159259777]],
  "24": [[-1.185524695630191,-4.88853259247861],[-0.4173779565405037,-4.888533502250622],[-0.39995997497694763,-3.9112932080324576],[-1.2031038270488297,-3.9200185045352187]],
  "25": [[-0.39992007610664637,-4.888533522927259],[0.3944134836338261,-4.888534463714225],[0.3944677785164874,-3.6145922074890904],[-0.3999720887550018,-3.614591266576216]],
  "26": [[0.40314242385075477,-4.888534474052543],[1.1974759835912274,-4.88853541483951],[1.1888713414824308,-3.9025688260789444],[0.3944551332046482,-3.9112941489160082]],
  // ... many more omitted previously ...
};
    [1.005193735398385, 3.794212792182116],
    [0.6606430522838724, 3.777481691562317],
    [0.6203746193696756, 4.071201373533244],
    [0.6019920697550103, 4.395017150202466],
    [0.6096638695789592, 4.643427788083562]
  ],
  "5": [
    [0.20350193824266222, 4.629137584161132],
    [-0.15283717884920442, 4.614808544270673],
    [-0.17264098556500132, 4.289232306960811],
    [0.19446691889563736, 4.327253880874675],
    [0.1775760469603424, 3.9830983723729068],
    [-0.18543253194667894, 3.975018245883334],
    [-0.15835979853992624, 3.7015680783589606],
    [0.22170429788768412, 3.7015680783589606]
  ],
  "6": [
    [-0.5445767860436023, 4.055287815442947],
    [-0.9524792071242159, 4.039327111452758],
    [-0.9334216629191108, 4.258619006405277],
    [-0.5737370481882117, 4.227830196794404],
    [-0.5531076311891642, 4.476679068635429],
    [-0.931176502826025, 4.454532570464962],
    [-0.942877720361628, 4.65055747889065],
    [-0.5641729372833191, 4.678980287052746]
  ],
  "7": [
    [-1.4070636188146017, 4.650557478890649],
    [-1.6861569682027688, 4.629137584161132],
    [-1.743909621259228, 4.273947151048547],
    [-1.4432356435508622, 4.273947151048547],
    [-1.464578009305223, 3.942579604557554],
    [-1.7655368824434092, 3.901762422953901],
    [-1.67493525881828, 4.742363795799714],
    [-1.4175317884232008, 4.784188703131495]
  ],
  "8": [
    [-2.1751663575259634, 4.756343221762354],
    [-2.215938927181248, 4.564342557531972],
    [-2.230034698285636, 4.357477734562217],
    [-2.2561080111550966, 4.08706871956624],
    [-2.607833149313344, 4.055287815442947],
    [-2.5934280803198235, 4.304473261301361],
    [-2.599747895559103, 4.520694156222627],
    [-2.6021742138848927, 4.714289513304952]
  ],
  "9": [
    [-2.977158901885408, 4.7633189739580555],
    [-3.0005481431961054, 4.557093536486835],
    [-3.0464989237363183, 4.266288902190226],
    [-3.0536991544190593, 4.079141173646852],
    [-3.385253628354749, 4.071201373533244],
    [-3.394695120362098, 4.235544112078362],
    [-3.409315154013633, 4.447130126207525],
    [-3.4210159071775457, 4.6576780107938305]
  ],
  "10": [
    [-3.751938128504188, 4.763318973958055],
    [-4.0067645498755695, 4.735359443088019],
    [-4.304636290080955, 4.728346160045597],
    [-4.556579914721102, 4.7283461600455965],
    [-4.773092487487787, 4.664788750800734],
    [-4.794972857594976, 4.42485894154909],
    [-4.779957193552198, 4.173523791006672],
    [-4.77903426385067, 3.893562496007508]
  ],
  "11": [
    [-4.742363795799713, 3.436134605311224],
    [-4.469307696227045, 3.431669595605641],
    [-4.227830196794404, 3.4650704998838053],
    [-3.9992224070273097, 3.4923546228343083],
    [-4.039327111452758, 3.0878765192031574],
    [-4.235544112078362, 3.0476823018267463],
    [-4.417414080203198, 3.0332692649765804],
    [-4.607628835807823, 3.015159006359024]
  ],
  "12": [
    [-4.686061773145124, 2.6093173090780124],
    [-4.671889069449081, 2.2727186974706473],
    [-4.380033347301547, 2.2774056739698345],
    [-4.3650064517343505, 2.601109686865493],
    [-4.047313278442047, 2.640437071288795],
    [-4.023320519398904, 2.307750909862496],
    [-3.769097006444662, 2.3218499725510973],
    [-3.7774816915623166, 2.6189778144110685]
  ],
  "13": [
    [-4.258619006405277, 1.8216784451174928],
    [-4.250938140886273, 1.4689307270676928],
    [-4.4693076962270455, 1.4464674096020442],
    [-4.454532570464963, 1.8106214287847595],
    [-4.700194984725088, 1.7900937380770752],
    [-4.678980287052762, 1.417665550316953],
    [-4.015299310458567, 1.4703422811940214],
    [-4.015299310458568, 1.8244555460055176]
  ],
  "14": [
    [-4.102890777749994, 1.030959430143321],
    [-4.055287815442947, 0.6366183236514198],
    [-4.296857861284932, 0.6300668157776599],
    [-4.250938140886273, 1.06968311831703],
    [-4.439716602449802, 1.0212929319419473],
    [-4.461925312609535, 0.657274771832885],
    [-4.700194984725088, 0.6063219233529082],
    [-4.643427788083562, 1.0233643525075402]
  ],
  "15": [
    [-4.700194984725088, 0.2526342448701215],
    [-4.678980287052746, -0.22422246727162748],
    [-4.4099587285081885, -0.2523318765908791],
    [-4.395017150202466, 0.215528138377351],
    [-4.118666299423466, 0.24402188612322925],
    [-4.039327111452758, -0.2381197138757232],
    [-3.7354341395690644, -0.2447221599083841],
    [-3.735434139569064, 0.22893386660518186]
  ],
  "16": [
    [-4.266288902190226, -0.5641664673585757],
    [-4.258619006405277, -0.9560044478654258],
    [-4.439716602449801, -0.9768888914227286],
    [-4.409958728508189, -0.5937221025350871],
    [-4.593240253573322, -0.6053251644641434],
    [-4.571582183329019, -0.9500731591819761],
    [-4.742363795799714, -0.9848330875444511],
    [-4.707247397060241, -0.5842672137794921]
  ],
  "17": [
    [-4.7493585952023, -1.357712119041924],
    [-4.749358595202301, -1.767180853356155],
    [-4.491392240618989, -1.848478418290544],
    [-4.484040801349066, -1.4223344194243155],
    [-4.157906338591249, -1.4360558447510703],
    [-4.157906338591249, -1.853955577813694],
    [-3.852381934810053, -1.8437036685511952],
    [-3.827526528386668, -1.4719879685026263]
  ],
  "18": [
    [-4.5860306798101504, -2.2186309999459697],
    [-4.571582183329019, -2.5505808729647823],
    [-4.342386891023748, -2.6141102454524296],
    [-4.334826100775862, -2.242255658853168],
    [-4.102890777749993, -2.1688329385060556],
    [-4.079141173646855, -2.6939897643421125],
    [-4.7563432217623545, -2.6058923689172406],
    [-4.7563432217623545, -2.1751663575259617]
  ],
  "19": [
    [-4.542563905673546, -3.0560233969676522],
    [-4.51338434346377, -3.343814810790821],
    [-4.258619006405278, -3.3874177419475187],
    [-4.258619006405278, -3.123951458125887],
    [-4.023320519398906, -2.9923836210992256],
    [-4.03932711145276, -3.4719407042815846],
    [-4.728346160045598, -3.4768216410905057],
    [-4.728346160045598, -2.9369425042752098]
  ],
  "20": [
    [-4.693132900768115, -3.7921104741804537],
    [-4.678980287052745, -4.043239356272133],
    [-4.6362876125132795, -4.292378258150862],
    [-4.607628835807823, -4.566436466152431],
    [-4.118666299423467, -4.659290651897633],
    [-4.063250019365881, -4.407098133365786],
    [-4.063250019365881, -4.123510974606851],
    [-4.063250019365881, -3.9012399061283354]
  ],
  "21": [
    [-3.0540220615407927, -4.266288902190227],
    [-3.2768454680740824, -4.250938140886257],
    [-3.2956159312142996, -4.4322926545318015],
    [-3.0752784294117546, -4.47667906863543],
    [-2.9697957757084334, -4.714289513304953],
    [-3.4094979780911525, -4.714289513304953],
    [-2.9125175337176836, -4.063250019365882],
    [-3.5359160494651305, -4.055287815442949]
  ],
  "22": [
    [-2.5933028609019986, -4.749358595202301],
    [-2.2315013108794237, -4.728346160045598],
    [-2.2287407039255767, -4.4693076962270455],
    [-2.595812665646995, -4.447130126207525],
    [-2.602331224569327, -4.142244479227929],
    [-2.271404128639219, -4.0870687195662425],
    [-2.301939005262639, -3.8275265283866684],
    [-2.6092376729742526, -3.8192164886317053]
  ],
  "23": [
    [-1.774754628675825, -4.535284583962278],
    [-1.4270899971001785, -4.5570935364868355],
    [-1.3986653240847893, -4.327253880874677],
    [-1.733918286108784, -4.289232306960811],
    [-1.8781050269922266, -4.150081419700161],
    [-1.310668430577765, -4.1265373032265895],
    [-1.2786920562092512, -4.749358595202301],
    [-1.829338871409068, -4.7633189739580395]
  ],
  "24": [
    [-0.9205575426361514, -4.491392240618989],
    [-0.6333433924567157, -4.49139224061899],
    [-0.676999760830293, -4.266288902190227],
    [-0.8888916442163891, -4.250938140886257],
    [-1.0437665508536225, -4.728346160045598],
    [-0.5452149413885535, -4.7633189739580395],
    [-0.4921069898828375, -4.196865075256969],
    [-1.0767798492608005, -4.102890777749994]
  ],
  "25": [
    [-0.20875337607393962, -4.728346160045598],
    [0.1946224810351955, -4.714289513304953],
    [0.2000993315868987, -4.42485894154909],
    [-0.19323213579383003, -4.395017150202467],
    [-0.1678867354238765, -4.110783891464164],
    [0.1984110882953794, -4.110783891464164],
    [0.1887551577953925, -3.777481691562317],
    [-0.1344041099233603, -3.718526138613372]
  ],
  "26": [
    [0.6282773692492972, -4.327253880874677],
    [0.8825799998174433, -4.327253880874676],
    [0.864172678217392, -4.549833771797948],
    [0.6815591748632899, -4.542563905673529],
    [0.5690614508907937, -4.721322642786647],
    [1.0646339324339709, -4.735359443088019],
    [1.082634892548226, -4.196865075256971],
    [0.4887510207257776, -4.102890777749994]
  ],
  "27": [
    [1.434694784596625, -4.2815951787478586],
    [1.6750626502209296, -4.2815951787478586],
    [1.6767517496471231, -4.506063654386698],
    [1.4518127428668037, -4.48404080134905],
    [1.373324324841192, -4.686061773145124],
    [1.8800641439240422, -4.721322642786647],
    [1.8633635942502038, -4.1028907777499946],
    [1.3144715122241815, -4.094985488047474]
  ],
  "28": [
    [2.6118895718006643, -4.165720693219135],
    [2.3048586025035065, -4.181314943428715],
    [2.5767658695435784, -4.342386891023748],
    [2.3377610431705294, -4.342386891023748],
    [2.1781074040313815, -4.535284583962278],
    [2.508471672518117, -4.5643425575319725],
    [2.5994684768190313, -3.827526528386669],
    [2.3941161844056396, -3.835824223831355]
  ],
  "29": [
    [3.0887532230341748, -4.506063654386699],
    [3.2799616997807735, -4.506063654386699],
    [3.338223862338718, -4.319670900193388],
    [3.147315182453247, -4.2815951787478586],
    [2.9481697357252417, -4.714289513304953],
    [3.448028032207681, -4.728346160045598],
    [3.4926024329746252, -4.142244479227928],
    [2.9056442701528993, -4.0313300217493016]
  ],
  "30": [
    [4.185342781335221, -4.258619006405278],
    [4.185342781335221, -4.258619006405278],
    [4.185342781335221, -4.258619006405278],
    [4.185342781335221, -4.258619006405278],
    [4.185342781335221, -4.258619006405278],
    [4.185342781335221, -4.258619006405278],
    [4.185342781335221, -4.258619006405278],
    [4.185342781335221, -4.258619006405278]
  ],
  "31": [
    [4.304473261301362, -3.0656433194896024],
    [4.289232306960812, -3.3252203747885907],
    [4.5133843434637715, -3.057202612535924],
    [4.476679068635429, -3.340770092382551],
    [4.756343221762354, -2.9145802200619713],
    [4.721322642786647, -3.428776426275296],
    [4.118666299423467, -2.93588784834929],
    [4.1028907777499946, -3.444169102549457]
  ],
  "32": [
    [4.349937658947436, -2.2316152563017795],
    [4.349937658947436, -2.537623092549681],
    [4.535284583962278, -2.229444163999296],
    [4.535284583962279, -2.500790430019616],
    [4.110783891464163, -2.1214753614791246],
    [4.087068719566242, -2.6767393389199725],
    [4.735359443088019, -2.143655909021035],
    [4.735359443088019, -2.6328112124617826]
  ],
  "33": [
    [3.9750182458833345, -1.3134809062016206],
    [3.958823123750142, -1.7796728034208822],
    [4.134396208576687, -1.378252978891115],
    [4.094985488047465, -1.8800001203120598],
    [4.349937658947436, -1.3882286051551207],
    [4.2815951787478586, -1.8553388073257746],
    [4.5570935364868355, -1.3904981692326364],
    [4.535284583962278, -1.7967557135650294]
  ],
  "34": [
    [4.296857861284932, -0.6375678401096915],
    [4.296857861284932, -0.9000954511109389],
    [4.4987327364051986, -0.6402601602321354],
    [4.491392240618989, -0.927921549890545],
    [4.079141173646853, -0.5204300478602671],
    [4.071201373533244, -1.0722528960051383],
    [4.6576780107938305, -1.0364524296370021],
    [4.678980287052745, -0.5424739781570366]
  ],
  "35": [
    [4.134396208576687, 0.17513685695469783],
    [4.118666299423466, -0.05337999485329516],
    [4.289232306960812, 0.15762893510080028],
    [4.289232306960811, -0.18014735440091134],
    [4.513384343463771, 0.19842417891254746],
    [4.491392240618988, -0.11783153266799136],
    [4.714289513304952, 0.3171623417089583],
    [4.728346160045597, -0.23034854154654943]
  ],
  "36": [
    [4.118666299423466, 1.0065898002788978],
    [4.110783891464163, 0.7097020334560599],
    [4.250938140886273, 0.9943531075535161],
    [4.243246986775533, 0.6709145578737123],
    [4.4322926545318, 1.0146048497730604],
    [4.424858941549089, 0.6299422270967762],
    [4.629137584161132, 0.9666330422064859],
    [4.629137584161132, 0.6105051493301817]
  ],
  "37": [
    [4.258619006405278, 1.7765121860529551],
    [4.258619006405277, 1.5431568564696658],
    [4.461925312609534, 1.757655717385523],
    [4.454532570464963, 1.500228584574854],
    [4.700194984725087, 1.8478378020403683],
    [4.721322642786663, 1.3542222286694088],
    [4.094985488047465, 1.3373983429596987],
    [4.047313278442048, 1.872867705795991]
  ],
  "38": [
    [3.9017624229539005, 2.6677494463943714],
    [3.8606427630307367, 2.4356327175795642],
    [4.055287815442947, 2.2473387362668507],
    [4.094985488047464, 2.5372358764241554],
    [4.304473261301361, 2.563446704999278],
    [4.334826100775876, 2.2347814163001507],
    [4.484040801349066, 2.557254257561094],
    [4.484040801349066, 2.2329915189549996]
  ],
  "39": [
    [4.087068719566241, 3.3956344549353994],
    [4.087068719566241, 3.0973692663262082],
    [4.281595178747858, 3.3651480556473117],
    [4.227830196794404, 3.0876113790007773],
    [4.439716602449801, 3.359905280919345],
    [4.40995872850819, 3.079934128828385],
    [4.629137584161131, 3.343242040828642],
    [4.5860306798101504, 3.0652144969182697]
  ]
}
*/

/** Jail offsets provided for the jail tile; we remap GO_TO_JAIL (30) to Jail (10) */
const PERMA_JAIL_RAW: Record<string, [number, number][]> = {
  // AREA_CORNERS and generators inserted below
  "0": [
    [-4.447130126207525, 3.779089997200221],
    [-3.7858538657341025, 4.393143184312988],
    [-3.760700551656716, 3.7965020342484674],
    [-4.4099587285081885, 4.386123705651377],
    [-4.110783891464163, 3.8384964101631396],
    [-4.134396208576686, 4.309895793628047],
    [-3.9344406536234877, 4.117795693208166],
    [-4.296857861284932, 4.072931916277007]
  ]
}

// === BUY PAGE ACCENTS BY TILE ===
const BUY_ACCENT_BY_TILE: Record<number, string> = {
  // 1-3
  1: '#693B27', 2: '#693B27', 3: '#693B27',
  // 6-8-9
  6: '#789DB0', 8: '#789DB0', 9: '#789DB0',
  // 11-13-14
  11: '#992B69', 13: '#992B69', 14: '#992B69',
  // 16-18-19
  16: '#AE671A', 18: '#AE671A', 19: '#AE671A',
  // 21-23-24
  21: '#A91A1E', 23: '#A91A1E', 24: '#A91A1E',
  // 26-27-29
  26: '#B3AB0F', 27: '#B3AB0F', 29: '#B3AB0F',
  // 31-32-34
  31: '#1A7D3F', 32: '#1A7D3F', 34: '#1A7D3F',
  // 37-39 (note: 38 is not a property)
  37: '#105083', 39: '#105083',
  // Stations
  5: '#0F0F0F', 15: '#0F0F0F', 25: '#0F0F0F', 35: '#0F0F0F',
  // Utilities
  12: '#98A496', 28: '#98A496',
}

// Fallback if permanent placements data is commented out above
const PERMA_PLACEMENTS_RAW: Record<string, [number, number][]> = {}

function buildPermanentPlacements(): PlacementOverrides {
  const out: PlacementOverrides = {}
  for (const [k, v] of Object.entries(PERMA_PLACEMENTS_RAW)) {
    const n = Number(k); if (!Number.isNaN(n)) out[n] = v as any
  }
  // 10 = Jail placements
  if (PERMA_JAIL_RAW?.['0']) {
    out[10] = PERMA_JAIL_RAW['0']
    // Do not alias 30 (Go To Jail) to 10; keep 30 separate
  }
  return out
}

export default function Home() {

  const { state, connected, send, meId } = useSocketWorker();
  // const [state, setState] = useState<RoomState & { ready?: Record<string, boolean>, adminId?: string } | null>(null)
  // const [connected, setConnected] = useState<boolean>(socket.connected)
  const [err, setErr] = useState<string>('')
  const [tradeState, setTradeState] = useState<{ isOpen: boolean; otherPlayerId: string | null }>({ isOpen: false, otherPlayerId: null });
  const [isSelectingTradePlayer, setIsSelectingTradePlayer] = useState(false);

  const openTrade = (otherPlayerId: string) => {
    setTradeState({ isOpen: true, otherPlayerId });
  };

  const closeTrade = () => {
    setTradeState({ isOpen: false, otherPlayerId: null });
  };

  const [name, setName] = useState(() => {
    if (typeof window !== 'undefined') {
      const v = window.localStorage.getItem(NAME_KEY)
      if (v && v.trim()) return v
    }
    return 'Oyuncu-' + Math.floor(Math.random() * 1000)
  })
  const [roomId, setRoomId] = useState('oda-1')
  // Fullscreen handling for 3D panel
  const scenePanelRef = useRef<HTMLDivElement | null>(null)
  const sceneCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const buyTimerStartedRef = useRef(false)


  useEffect(() => {
    const host = scenePanelRef.current
    if (!host) return
    // try to grab the first three/fiber canvas
    const c = host.querySelector('canvas') as HTMLCanvasElement | null
    sceneCanvasRef.current = c

    // If your canvas mounts later (suspense), try again on next frame:
    if (!c) requestAnimationFrame(() => {
      const late = host.querySelector('canvas') as HTMLCanvasElement | null
      if (late) sceneCanvasRef.current = late
    })
  }, [])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const prevScrollRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const prevSceneSizeRef = useRef<{ w: number; h: number } | null>(null)
  // Auto-scroll to board when the game transitions to started
  const prevStartedRef = useRef<boolean | null>(null)
  useEffect(() => {
    const started = !!state?.started
    if (prevStartedRef.current == null) { prevStartedRef.current = started; return }
    if (prevStartedRef.current === false && started === true) {
      const el = scenePanelRef.current
      // Wait a tick for layout to settle, then scroll smoothly to the board
      requestAnimationFrame(() => {
        if (el && el.scrollIntoView) {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' }) } catch { window.scrollTo({ top: (document.documentElement?.scrollHeight || document.body.scrollHeight), behavior: 'smooth' as any }) }
        } else {
          window.scrollTo({ top: (document.documentElement?.scrollHeight || document.body.scrollHeight), behavior: 'smooth' as any })
        }
      })
    }
    prevStartedRef.current = started
  }, [state?.started])
  useEffect(() => {
    const onFs = () => {
      const fs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement)
      setIsFullscreen(fs)
      if (!fs) {
        const { x, y } = prevScrollRef.current
        // Restore scene size to pre-fullscreen pixels to avoid "zoomed" feel
        const host = scenePanelRef.current
        const scene = host ? (host.querySelector('.scene') as HTMLDivElement | null) : null
        const canvas = host ? (host.querySelector('canvas') as HTMLCanvasElement | null) : null
        const prev = prevSceneSizeRef.current
        if (prev && scene) {
          scene.style.width = prev.w + 'px'
          scene.style.height = prev.h + 'px'
        }
        if (canvas) {
          canvas.style.width = '100%'
          canvas.style.height = '100%'
        }
        // Force layout update for three/fiber
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'))
          window.scrollTo(x, y)
        })
      }
    }
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('webkitfullscreenchange', onFs as any)
    document.addEventListener('msfullscreenchange', onFs as any)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('webkitfullscreenchange', onFs as any)
      document.removeEventListener('msfullscreenchange', onFs as any)
    }
  }, [])
  function toggleFullscreen() {
    const el = scenePanelRef.current
    if (!el) return
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      document.exitFullscreen?.().catch(() => { })
        ; (document as any).webkitExitFullscreen?.()
    } else {
      prevScrollRef.current = { x: window.scrollX, y: window.scrollY }
      // Save current scene pixel size so we can restore on exit
      const host = scenePanelRef.current
      const scene = host ? (host.querySelector('.scene') as HTMLDivElement | null) : null
      if (scene) {
        const r = scene.getBoundingClientRect()
        prevSceneSizeRef.current = { w: Math.round(r.width), h: Math.round(r.height) }
      } else {
        prevSceneSizeRef.current = null
      }
      el.requestFullscreen?.().catch(() => { })
        ; (el as any).webkitRequestFullscreen?.()
    }
  }

  // camera presets (FOV 56)
  const [preset, setPreset] = useState(0)
  const [topDown, setTopDown] = useState(false)
  const edgeBase: CameraPreset[] = ([
    // Edge 1 (parallel to +Z): front side
    { pos: [0.0, 8.5, 10.5], target: [0, 0, 0], fov: 56 },
    // Edge 4 (parallel to -X): left side
    { pos: [-10.5, 8.5, 0.0], target: [0, 0, 0], fov: 56 },
    // Edge 3 (parallel to -Z): back side
    { pos: [0.0, 8.5, -10.5], target: [0, 0, 0], fov: 56 },
    // Edge 2 (parallel to +X): right side
    { pos: [10.5, 8.5, 0.0], target: [0, 0, 0], fov: 56 },
    // Bird's-eye top-down
    { pos: [0.0, 16.0, 0.0], target: [0, 0, 0], fov: 36 },
  ])
  const edgeTop: CameraPreset[] = ([
    // Top-down variant for each edge: slightly above center with edge-aligned bias
    { pos: [0.0, 9.76, 0.01], target: [0, 0, 0], fov: 55.91 },
    { pos: [-0.01, 9.76, 0.0], target: [0, 0, 0], fov: 55.91 },
    { pos: [0.0, 9.76, -0.01], target: [0, 0, 0], fov: 55.91 },
    { pos: [0.01, 9.76, 0.0], target: [0, 0, 0], fov: 55.91 },
  ])
  const presets: CameraPreset[] = (topDown ? edgeTop : edgeBase)
  const waitingPreset: CameraPreset = useMemo(() => {
    try {
      const raw = localStorage.getItem('monopoly.dev.camera')
      if (raw) {
        const d = JSON.parse(raw)
        const pos: [number, number, number] = Array.isArray(d.pos) && d.pos.length === 3 ? [d.pos[0], d.pos[1], d.pos[2]] : [0, 12, 0]
        const target: [number, number, number] = Array.isArray(d.target) && d.target.length === 3 ? [d.target[0], d.target[1], d.target[2]] : [0, 0, 0]
        const fov = typeof d.fov === 'number' ? d.fov : 55.69041415519604
        return { pos, target, fov }
      }
    } catch { }
    return { pos: [0, 12, 0], target: [0, 0, 0], fov: 55.69041415519604 }
  }, [])
  useEffect(() => { ensureDevFlagsAPI() }, [])
  // Arrow keys: cycle camera presets (1..4) left/right; Up=top-down on, Down=off
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (document.activeElement as any)?.isContentEditable) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setPreset((p) => (p + 1) % 4)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setPreset((p) => (p + 4 - 1) % 4)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); setTopDown(true)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault(); setTopDown(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // placements
  const PERMANENT = useMemo(buildPermanentPlacements, [])
  const [placements, setPlacements] = useState<PlacementOverrides>(PERMANENT)
  useEffect(() => {
    try {
      const existing = localStorage.getItem(PLACE_KEY)
      if (!existing) localStorage.setItem(PLACE_KEY, JSON.stringify(PERMANENT))
    } catch { }
  }, [PERMANENT])

  // Dev: local 8-player simulator
  const [simPlayers, setSimPlayers] = useState<Record<string, Player> | null>(null)
  const [simOrder, setSimOrder] = useState<string[]>([])
  useEffect(() => {
    ensureDevFlagsAPI()
    if (getDevFlag('sim8' as any)) {
      // initialize 8 local players at GO
      const mk = (id: string, name: string, position: number): Player => ({ id, name, cash: 0, position, inJail: false, jailTurns: 0, getOutOfJail: 0, bankrupt: false, properties: [], houses: {}, hotels: {} })
      const ids = Array.from({ length: 8 }, (_, i) => `sim-${i + 1}`)
      const m: Record<string, Player> = {}
      ids.forEach((id, i) => { m[id] = mk(id, `P${i + 1}`, 0) })
      setSimPlayers(m)
      setSimOrder(ids)
      // Expose simple runtime API
      const w: any = typeof window !== 'undefined' ? window : null
      if (w) {
        w.MonopolyDev = w.MonopolyDev || {}
        w.MonopolyDev.sim = {
          init: () => {
            const ids = Array.from({ length: 8 }, (_, i) => `sim-${i + 1}`)
            setSimOrder(ids)
            setSimPlayers(Object.fromEntries(ids.map((id, i) => [id, mk(id, `P${i + 1}`, 0)])))
          },
          step: (d: number) => {
            setSimPlayers(prev => {
              if (!prev) return prev
              const n: Record<string, Player> = {}
              for (const [id, p] of Object.entries(prev)) {
                const pos = (((p.position + d) % 40) + 40) % 40
                n[id] = { ...p, position: pos }
              }
              return n
            })
          },
          clear: () => { setSimPlayers(null); setSimOrder([]) },
        }
      }
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!getDevFlag('sim8' as any) || !simPlayers) return
      const k = e.key.toLowerCase()
      if (k === 'i') {
        // reset to GO
        setSimPlayers(prev => {
          if (!prev) return prev
          const n: Record<string, Player> = {}
          for (const [id, p] of Object.entries(prev)) n[id] = { ...p, position: 0, inJail: false }
          return n
        })
      }
      if (k === 'l') {
        setSimPlayers(prev => {
          if (!prev) return prev
          const n: Record<string, Player> = {}
          for (const [id, p] of Object.entries(prev)) {
            let pos = (p.position + 1) % 40
            let inJail = p.inJail
            if (pos === 30) { inJail = true; pos = 10 }
            n[id] = { ...p, position: pos, inJail }
          }
          return n
        })
      }
      if (k === 'k') {
        setSimPlayers(prev => {
          if (!prev) return prev
          const n: Record<string, Player> = {}
          for (const [id, p] of Object.entries(prev)) {
            let pos = (p.position + 39) % 40
            let inJail = p.inJail
            if (pos === 30) { inJail = true; pos = 10 }
            n[id] = { ...p, position: pos, inJail }
          }
          return n
        })
      }
      // Force all to jail (O) or clear jail (P)
      if (k === 'o') {
        setSimPlayers(prev => {
          if (!prev) return prev
          const n: Record<string, Player> = {}
          for (const [id, p] of Object.entries(prev)) n[id] = { ...p, inJail: true, position: 10 }
          return n
        })
      }
      if (k === 'p') {
        setSimPlayers(prev => {
          if (!prev) return prev
          const n: Record<string, Player> = {}
          for (const [id, p] of Object.entries(prev)) n[id] = { ...p, inJail: false }
          return n
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [simPlayers])

  // If there are no players yet, render 4 preview tokens so models are visible
  const previewPlayers: Record<string, Player> = useMemo(() => {
    if (state && Object.keys(state.players || {}).length > 0) {
      return {
        'demo-car': { id: 'demo-car', name: 'Car', cash: 0, position: 0, inJail: false, jailTurns: 0, getOutOfJail: 0, bankrupt: false, properties: [], houses: {}, hotels: {} },
        'demo-dog': { id: 'demo-dog', name: 'Dog', cash: 0, position: 10, inJail: false, jailTurns: 0, getOutOfJail: 0, bankrupt: false, properties: [], houses: {}, hotels: {} },
        'demo-hat': { id: 'demo-hat', name: 'Hat', cash: 0, position: 20, inJail: false, jailTurns: 0, getOutOfJail: 0, bankrupt: false, properties: [], houses: {}, hotels: {} },
        'demo-shoe': { id: 'demo-shoe', name: 'Shoe', cash: 0, position: 30, inJail: false, jailTurns: 0, getOutOfJail: 0, bankrupt: false, properties: [], houses: {}, hotels: {} },
      };
    }
    return {
      'demo-car': { id: 'demo-car', name: 'Car', cash: 0, position: 0, inJail: false, jailTurns: 0, getOutOfJail: 0, bankrupt: false, properties: [], houses: {}, hotels: {} },
      'demo-dog': { id: 'demo-dog', name: 'Dog', cash: 0, position: 10, inJail: false, jailTurns: 0, getOutOfJail: 0, bankrupt: false, properties: [], houses: {}, hotels: {} },
      'demo-hat': { id: 'demo-hat', name: 'Hat', cash: 0, position: 20, inJail: false, jailTurns: 0, getOutOfJail: 0, bankrupt: false, properties: [], houses: {}, hotels: {} },
      'demo-shoe': { id: 'demo-shoe', name: 'Shoe', cash: 0, position: 30, inJail: false, jailTurns: 0, getOutOfJail: 0, bankrupt: false, properties: [], houses: {}, hotels: {} },
    };
  }, [state?.players])

  const effectivePlayers = useMemo(() => {
    if (simPlayers) return simPlayers
    const real = state?.players || {}
    return Object.keys(real).length ? real : previewPlayers
  }, [simPlayers, state?.players, previewPlayers])

  const effectiveOrder = useMemo(() => {
    if (simPlayers && simOrder.length) return simOrder
    const real = state?.order || []
    if (real.length) return real
    return Object.keys(previewPlayers)
  }, [simPlayers, simOrder, state?.order, previewPlayers])

  const tokenModels = useMemo(() => {
    const ids = Object.keys(effectivePlayers)
    const cfgs = [
      // Encode space in folder name to be safe across servers
      // Brushed chrome base color; material is metallic in Board3D
      { url: '/models/Player%20Tokens/Car.stl', color: '#e6eaee' },
      { url: '/models/Player%20Tokens/Dog.stl', color: '#e6eaee' },
      { url: '/models/Player%20Tokens/Hat.stl', color: '#e6eaee' },
      { url: '/models/Player%20Tokens/Shoe.stl', color: '#e6eaee' },
    ] as const
    const m: Record<string, any> = {}
    ids.forEach((id, i) => {
      m[id] = {
        url: cfgs[i % cfgs.length].url,
        color: cfgs[i % cfgs.length].color,
        fitSize: 0.36,
        y: 0.01,
      }
    })
    return m
  }, [effectivePlayers])

  // dice animation trigger & url selection based on server dice outcome
  const [rollTick, setRollTick] = useState(0)
  const [dicePlaying, setDicePlaying] = useState(false)
  const [auctionGraceActive, setAuctionGraceActive] = useState(false)
  const lastAuctionActiveRef = useRef<boolean>(false)
  const auctionGraceTimerRef = useRef<number | null>(null)
  const [suppressButtons, setSuppressButtons] = useState(false)
  const suppressTimerRef = useRef<number | null>(null)
  function armSuppress(ms: number) {
    try { if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current as any) } catch { }
    setSuppressButtons(true)
    suppressTimerRef.current = window.setTimeout(() => setSuppressButtons(false), ms) as any
  }
  // Rotate dice +90┬░ around Y each throw
  const diceRotation = useMemo<[number, number, number]>(() => {
    const step = rollTick % 8
    // Spin clockwise 45┬░ per tick, and apply a constant -90┬░ offset only while the
    // roll animation is shown (keeps initial idle orientation unchanged).
    const spin = -((step * 45 * Math.PI) / 180)
    const base = step === 0 ? 0 : -Math.PI / 2
    return [0, spin + base, 0]
  }, [rollTick])
  const lastSeenKey = useRef<string | null>(null)
  const seededInitialFromFirstState = useRef(false)
  const localRollPending = useRef(false)

  // Seed lastSeenKey from the very first server state (if it already has dice),
  // so we don't auto-play on initial load/refresh.
  useEffect(() => {
    if (!seededInitialFromFirstState.current && state) {
      seededInitialFromFirstState.current = true
      const d0 = state.lastDice
      if (d0) lastSeenKey.current = `${d0.d1}-${d0.d2}-${d0.isDouble}`
    }
  }, [state])
  useLayoutEffect(() => {
    const d = state?.lastDice
    if (!d) return
    const key = `${d.d1}-${d.d2}-${d.isDouble}`
    if (key !== lastSeenKey.current || localRollPending.current) {
      lastSeenKey.current = key
      localRollPending.current = false
      setRollTick(t => t + 1)
      setDicePlaying(true)
    }
  }, [state?.lastDice])
  // Hold auction overlay visibility and button suppression for +2s after server finishes
  useEffect(() => {
    const active = !!((state as any)?.auction?.active)
    try { if (auctionGraceTimerRef.current) window.clearTimeout(auctionGraceTimerRef.current) } catch { }
    if (active) {
      setAuctionGraceActive(true)
    } else {
      if (lastAuctionActiveRef.current) {
        setAuctionGraceActive(true)
        auctionGraceTimerRef.current = window.setTimeout(() => setAuctionGraceActive(false), 2500) as any
      } else {
        setAuctionGraceActive(false)
      }
    }
    lastAuctionActiveRef.current = active
  }, [(state as any)?.auction?.active])

  function handleRollClick() {
    // Trigger server roll; mark local pending so we also replay if same pair repeats
    localRollPending.current = true
    send({ type: 'roll' } as any)
  }

  // socket
  // useEffect(() => {
  //   const onConnect = () => { setConnected(true); setErr('') }
  //   const onDisconnect = () => setConnected(false)
  //   const onConnectError = (e: any) => { setErr(String(e?.message || e)); setConnected(false) }

  //   // Batch state updates to one per frame to avoid jank on bursts
  //   let raf = 0
  //   let pending: any = null
  //   const flush = () => {
  //     raf = 0
  //     if (pending) { setState({ ...(pending as any) }); pending = null }
  //   }

  //   const onEvt = (evt: ServerEvent | any) => {
  //     if (evt.type === 'state') {
  //       pending = evt.state
  //       if (!raf) raf = requestAnimationFrame(flush)
  //     }
  //     if (evt.type === 'msg') {
  //       if (!getDevFlag('suppressMsgs' as any)) console.log('[MSG]', evt.text)
  //     }
  //     if (evt.type === 'error') alert(evt.text)
  //   }
  //   if (socket.connected) onConnect()
  //   socket.on('connect', onConnect)
  //   socket.on('disconnect', onDisconnect)
  //   socket.on('connect_error', onConnectError)
  //   socket.on('event', onEvt)
  //   return () => {
  //     if (raf) cancelAnimationFrame(raf)
  //     socket.off('connect', onConnect)
  //     socket.off('disconnect', onDisconnect)
  //     socket.off('connect_error', onConnectError)
  //     socket.off('event', onEvt)
  //   }
  // }, [])

  // persist name
  useEffect(() => {
    const t = setTimeout(() => {
      try { if (name && name.trim()) localStorage.setItem(NAME_KEY, name.trim()) } catch { }
    }, 120)
    return () => clearTimeout(t)
  }, [name])

  // function send(e: ClientEvent | any) { socket.emit('event', e) }

  const me = useMemo(() => state && meId ? state.players[meId] : null, [state, meId]);
  const isMyTurn = !!(state && state.order?.length && state.order[state.turnIndex] === meId);
  const isAdmin = !!(state && (state as any).adminId === meId)
  const allReady = !!(state && state.order?.every(id => (state as any).ready?.[id]))
  // Turn controls: allow roll if no dice yet, or doubles rolled; allow end turn if rolled and not doubles
  const canRoll = !!(isMyTurn && (!((state as any)?.lastDice) || ((state as any)?.lastDice?.isDouble === true)))
  const canEndTurn = !!(isMyTurn && !!((state as any)?.lastDice) && ((state as any)?.lastDice?.isDouble !== true))
  const [animatingRoute, setAnimatingRoute] = useState(false)
  // Reset key for current player's activity timer (e.g., on roll, on card draw)
  const [activityTick, setActivityTick] = useState(0)
  const moneyFxRef = useRef<MoneyFxHandle | null>(null)
  const [cardRects, setCardRects] = useState<Record<string, DOMRect>>({})
  const prevCashRef = useRef<Record<string, number>>({})
  const moneyQueueRef = useRef<MoneyTransfer[]>([])
  const enqueueTransfers = (arr: MoneyTransfer[]) => { if (arr && arr.length) moneyQueueRef.current = moneyQueueRef.current.concat(arr) }
  const flushTransfers = () => {
    const list = moneyQueueRef.current
    if (!list.length) return
    list.forEach(tr => moneyFxRef.current?.spawn(tr))
    moneyQueueRef.current = []
  }
  // If landed on an unowned buyable tile, show only auction instead of end-turn
  const myTile = me?.position
  const showAuction = useMemo(() => {
    try {
      if (!isMyTurn || !canEndTurn) return false
      // add this line:
      if (animatingRoute) return false

      if (myTile == null) return false
      const sp: any = (board as any).spaces?.[myTile]
      const t = sp?.type
      const isBuyable = t === 'PROPERTY' || t === 'STATION' || t === 'UTILITY'
      if (!isBuyable) return false
      const hasOwner = Object.values(state?.players || {}).some((pl: any) => (pl?.properties || []).includes(sp.id))
      return !hasOwner
    } catch { return false }
  }, [isMyTurn, canEndTurn, myTile, state?.players, animatingRoute])  // include animatingRoute in deps


  // --- Buy modal state: shows after a roll when landing on an unowned buyable space ---
  const [buyModal, setBuyModal] = useState<{ tile: number; progress: number } | null>(null)
  // Show central game buttons only when there is an action to perform
  const pendingCard: any = (state as any)?.pendingCard || null
  const currentAccent = useMemo(() => {
    const currentId = state?.order?.[state?.turnIndex ?? 0]
    const idxInOrder = currentId ? effectiveOrder.indexOf(currentId) : -1
    if (idxInOrder < 0) return '#f59e0b'
    const SLOTS = 8
    const offset = Math.max(0, Math.floor((SLOTS - effectiveOrder.length) / 2))
    const dotIndex = (offset + idxInOrder) % PLAYER_DOTS.length
    return PLAYER_DOTS[dotIndex]
  }, [state?.order, state?.turnIndex, effectiveOrder])
  // Track any player's hop for gating overlays and controls for all viewers
  const [anyAnimatingRoute, setAnyAnimatingRoute] = useState(false)
  useEffect(() => {
    const handler = (e: any) => {
      try { setAnyAnimatingRoute(!!(e?.detail?.active ?? (window as any)?.MonopolyRouteActive)) } catch { setAnyAnimatingRoute(false) }
    }
    handler(null as any)
    window.addEventListener('monopoly:routeActive', handler as any)
    return () => window.removeEventListener('monopoly:routeActive', handler as any)
  }, [])
  // Pass GO: show immediate credit during hop (only if server says this move earns GO)
  useEffect(() => {
    const onPassGo = (e: any) => {
      try {
        const pid = e?.detail?.playerId as string
        const amt = (board as any).goAmount || 200
        const pv = (state as any)?.pendingVisit
        const allowed = !!pv && pv.playerId === pid && pv.passedGo === true
        if (!allowed) return
        // Animate now
        moneyFxRef.current?.spawn({ kind: 'fromBank', toId: pid, amount: amt })
        // Advance our baseline snapshot by GO amount so later state diff only shows residuals
        const curSnap = prevCashRef.current
        const baseline = (curSnap[pid] != null) ? curSnap[pid]! : ((state as any)?.players?.[pid]?.cash ?? 0)
        prevCashRef.current = { ...curSnap, [pid]: baseline + amt }
      } catch { }
    }
    window.addEventListener('monopoly:passGo', onPassGo as any)
    return () => window.removeEventListener('monopoly:passGo', onPassGo as any)
  }, [state?.pendingVisit, state?.players])
  const showControls = useMemo(() => {
    const suppress = localRollPending.current || dicePlaying || anyAnimatingRoute || suppressButtons
    return !!(isMyTurn && !animatingRoute && !suppress && (canRoll || canEndTurn) && !buyModal && !pendingCard && !(state as any)?.auction?.active)
  }, [isMyTurn, animatingRoute, canRoll, canEndTurn, buyModal, pendingCard, anyAnimatingRoute, dicePlaying, suppressButtons, (state as any)?.auction?.active])
  const buyTimerRef = useRef<number | null>(null)
  function stopBuyTimer() {
    if (buyTimerRef.current != null) {
      cancelAnimationFrame(buyTimerRef.current as number)
      buyTimerRef.current = null
    }
  }
  const buyModalSeenKey = useRef<string | null>(null)
  const FADE_MS = 220
  const [buyVisible, setBuyVisible] = useState(false)
  // Additional render gate: delay mounting the overlay for 2000ms
  const [buyRenderReady, setBuyRenderReady] = useState(false)
  const [animatingMyMove, setAnimatingMyMove] = useState(false)
  const pendingBuyTileRef = useRef<number | null>(null)
  const pendingBuyTimerRef = useRef<number | null>(null)
  useEffect(() => () => {
    if (pendingBuyTimerRef.current) clearTimeout(pendingBuyTimerRef.current)
  }, [])

  // When a buy modal mounts, flip visible on next frame so CSS transitions run
  useEffect(() => {
    if (buyModal) requestAnimationFrame(() => setBuyVisible(true))
  }, [buyModal])

  // Delay showing the overlay content by 2000ms after buyModal is set
  useEffect(() => {
    if (!buyModal) { setBuyRenderReady(false); return }
    setBuyRenderReady(false)
    const id = window.setTimeout(() => setBuyRenderReady(true), 0)
    return () => { clearTimeout(id) }
  }, [buyModal?.tile])

  function closeBuyModal(after?: () => void) {
    setBuyVisible(false)
    stopBuyTimer()
    buyTimerStartedRef.current = false
    window.setTimeout(() => {
      setBuyModal(null)
      after?.()
    }, FADE_MS)
  }

  // Increment activity tick when current player rolls dice
  const diceKey = `${(state as any)?.lastDice?.d1 ?? ''}-${(state as any)?.lastDice?.d2 ?? ''}-${(state as any)?.lastDice?.isDouble ?? ''}`
  useEffect(() => {
    if (state?.lastDice) setActivityTick((t) => t + 1)
  }, [diceKey])

  // Increment activity tick when a pending action card appears for current player
  const currentId = state?.order?.[state?.turnIndex ?? 0]
  const pendingTs = (state as any)?.pendingCard?.ts ?? 0
  const pendingFor = (state as any)?.pendingCard?.playerId
  useEffect(() => {
    if (pendingTs && pendingFor && pendingFor === currentId) setActivityTick((t) => t + 1)
  }, [pendingTs, pendingFor, currentId])

  // Detect cash changes and trigger money animations (deferred until actions complete)
  const hasPendingCard = !!((state as any)?.pendingCard)
  useEffect(() => {
    const st = state as any
    if (!st?.players) return
    const players = st.players || {}
    const ids = Object.keys(players)
    const prev = prevCashRef.current
    const deltas: Record<string, number> = {}
    ids.forEach(id => {
      const cur = players[id]?.cash ?? 0
      const old = prev[id] ?? cur
      deltas[id] = cur - old
    })
    // Update snapshot
    const snap: Record<string, number> = {}
    ids.forEach(id => { snap[id] = players[id]?.cash ?? 0 })
    prevCashRef.current = snap

    const negatives = ids.filter(id => (deltas[id] || 0) < 0)
    const positives = ids.filter(id => (deltas[id] || 0) > 0)
    const sumNeg = -negatives.reduce((s, id) => s + Math.abs(deltas[id] || 0), 0)
    const sumPos = positives.reduce((s, id) => s + (deltas[id] || 0), 0)

    const transfers: MoneyTransfer[] = []
    // Single payer → single receiver
    if (negatives.length === 1 && positives.length === 1) {
      const fromId = negatives[0]
      const toId = positives[0]
      const amt = Math.min(-deltas[fromId], deltas[toId])
      if (amt > 0) transfers.push({ kind: 'playerToPlayer', fromId, toId, amount: amt })
    }
    // Many → one
    else if (negatives.length >= 1 && positives.length === 1 && sumPos > 0) {
      const toId = positives[0]
      negatives.forEach(fromId => {
        const amt = Math.abs(deltas[fromId])
        if (amt > 0) transfers.push({ kind: 'playerToPlayer', fromId, toId, amount: amt })
      })
    }
    // One → many
    else if (negatives.length === 1 && positives.length >= 1 && sumNeg > 0) {
      const fromId = negatives[0]
      positives.forEach(toId => {
        const amt = Math.abs(deltas[toId])
        if (amt > 0) transfers.push({ kind: 'playerToPlayer', fromId, toId, amount: amt })
      })
    }
    // To bank (tax/buy)
    else if (negatives.length === 1 && positives.length === 0) {
      const fromId = negatives[0]
      const amt = Math.abs(deltas[fromId])
      if (amt > 0) transfers.push({ kind: 'toBank', fromId, amount: amt })
    }
    // From bank (GO/reward)
    else if (positives.length === 1 && negatives.length === 0) {
      const toId = positives[0]
      const amt = Math.abs(deltas[toId])
      if (amt > 0) transfers.push({ kind: 'fromBank', toId, amount: amt })
    }
    if (!transfers.length) return

    // Defer until actions complete: while animating route or while a card is pending
    const shouldDefer = !!animatingMyMove || hasPendingCard
    if (shouldDefer) enqueueTransfers(transfers)
    else transfers.forEach(tr => moneyFxRef.current?.spawn(tr))
  }, [state, cardRects, animatingMyMove, hasPendingCard])

  // Flush queued money once both: no route animation and no pending card
  useEffect(() => {
    if (!animatingMyMove && !hasPendingCard) flushTransfers()
  }, [animatingMyMove, hasPendingCard])

  const forwardWheelToCanvas = (e: React.WheelEvent) => {
    const c = sceneCanvasRef.current
    if (!c) return
    // Re-fire a synthetic wheel event on the canvas so zoom still works
    const evt = new WheelEvent('wheel', {
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      deltaMode: e.deltaMode,
      clientX: e.clientX,
      clientY: e.clientY,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      bubbles: true,
      cancelable: true
    })
    c.dispatchEvent(evt)
    e.preventDefault()
  }



  // open modal once per dice key when appropriate
  useEffect(() => {
    try {
      if (!isMyTurn) return
      const d = state?.lastDice
      if (!d) return

      const key = `${d.d1}-${d.d2}-${d.isDouble}`
      const tile = me?.position
      if (!key || tile == null) return
      if (buyModalSeenKey.current === key) return

      const sp: any = (board as any).spaces?.[tile]
      const t = sp?.type
      const isBuyable = t === 'PROPERTY' || t === 'STATION' || t === 'UTILITY'
      const hasOwner = Object.values(state?.players || {}).some((pl: any) => (pl?.properties || []).includes(sp.id))
      if (!isBuyable || hasOwner) return

      // mark this dice result as handled
      buyModalSeenKey.current = key

      // Always set pending tile, and cancel any previously scheduled open
      pendingBuyTileRef.current = tile
      if (pendingBuyTimerRef.current) { clearTimeout(pendingBuyTimerRef.current as any); pendingBuyTimerRef.current = null }

      // If currently animating, defer opening until route completes; otherwise, open after a small delay
      if (animatingMyMove) {
        return
      }
      pendingBuyTimerRef.current = window.setTimeout(() => {
        setBuyModal({ tile, progress: 0 })
      }, 100) as any
    } catch { }
  }, [state?.lastDice, isMyTurn, me?.position, state?.players, animatingMyMove])


  // timer effect for modal (30s) - use tile as the stable dependency
  useEffect(() => {
    const tile = buyModal?.tile
    if (tile == null) return

    if (animatingMyMove) return

    if (buyTimerStartedRef.current) return
    buyTimerStartedRef.current = true

    let stopped = false
    const DURATION = 30_000
    const start = performance.now()

    const tick = (now: number) => {
      if (stopped) return
      const prog = Math.min(1, (now - start) / DURATION)

      // Only update if we're still on the same tile
      setBuyModal(b => (b && b.tile === tile) ? { ...b, progress: prog } : b)

      if (prog < 1) {
        buyTimerRef.current = requestAnimationFrame(tick)
      } else {
        closeBuyModal(() => send({ type: 'decline' } as any))
      }

    }

    buyTimerRef.current = requestAnimationFrame(tick)
    return () => { stopped = true; stopBuyTimer() }
  }, [buyModal?.tile, animatingMyMove])



  // Close modal if tile becomes owned by anyone (sync with server)
  useEffect(() => {
    if (!buyModal) return
    const sp: any = (board as any).spaces?.[buyModal.tile]
    const hasOwner = Object.values(state?.players || {}).some((pl: any) => (pl?.properties || []).includes(sp.id))
    if (hasOwner) {
      closeBuyModal()
    }

  }, [state?.players, buyModal])


  return (
    <main style={{ padding: '24px 28px' }}>
      <div className="no-card" style={{ display: 'flex', justifyContent: 'center' }}>
        <Image
          src="/Monopoly2.PNG"
          alt="Monopoly"
          width={3557}
          height={1157}
          priority
          sizes="100vw"
          style={{ display: 'block', width: '100%', height: 'auto', margin: '0 auto', borderRadius: 6, scale: '1', marginTop: '10vh', marginBottom: '5vh' }}
        />
      </div>
      <h1 style={{ margin: 'auto', fontSize: 80, fontWeight: 800, marginBottom: '9vh' }} className='shine-base shine' data-text="Monopoly'ye Hoşgeldin!">Monopoly'ye Hoşgeldin!</h1>
      <div className='no-card' style={{ textAlign: "center", marginBottom: '50vh' }}>
        <GoToGameButton targetId="game" sticky={false} showWhen="above-target" />
      </div>


      {/* Join / status */}
      <section style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', flexWrap: 'wrap' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="adın" />
        <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="oda" />
        {!me && (
          <button disabled={!connected} onClick={() => send({ type: 'join', name: name.trim(), roomId })}>
            Katıl
          </button>
        )}
        {me && (
          <button onClick={() => send({ type: 'readyToggle' } as any)}>
            {((state as any)?.ready && meId && (state as any).ready[meId]) ? 'Hazır değilim' : 'Hazırım'}
          </button>
        )}
        {/* Auto-start when all players are ready; no manual admin ordering button */}
        <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
          {connected ? `Bağlı (${meId})` : 'Bağlantı yok'} {err && `• ${err}`}
        </span>
      </section>
      {/* Public rooms */}
      <RoomsList onSelect={(rid) => setRoomId(rid)} onJoin={(rid) => send({ type: 'join', name: name.trim(), roomId: rid })} me={me} />

      {/* Players list + kick */}
      {state && !isFullscreen && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, margin: '8px 0' }}>
          {state.order.map(pid => {
            const p = state.players[pid]
            if (!p) return null
            const ready = (state as any).ready?.[pid]
            const isMe = pid === meId
            return (
              <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, border: '1px solid #ddd', borderRadius: 8, width: 260 }}>
                <div>
                  <b>{p.name}</b>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{ready ? 'Hazır ✅' : 'Hazır değil ❌'}</div>
                </div>
                {isAdmin && !isMe && (
                  <div style={{ marginTop: 6 }}>
                    <button onClick={() => send({ type: 'kick', playerId: pid } as any)}>At</button>
                  </div>

                )}

              </div>
            )
          })}
        </div>
      )}

      {/* Dev placement UI */}
      <PlacementPanel />

      {/* 3D board */}
      <div id='game' ref={scenePanelRef} style={{ marginTop: 12, position: 'relative' }}>
        <LoadingOverlay />
        {getDevFlag('showFPSTracker' as any) && (
          <DevFPS />
        )}

        {!getDevFlag('disable3D') && (
          <>
            <Board3D
              players={effectivePlayers}
              order={effectiveOrder}
              boardImageUrl="/board.png"

              models={tokenModels}

              worldSize={10}
              outfill={0.08}
              boardThickness={0.3}
              rimHeight={0.05}
              rimColor="#000"
              lighting={{ ambient: 0.3, hemi: 0.2, key: 0.85, fill: 0.4, exposure: 1.0, background: '#7d917a' }}

              presets={presets}
              presetIndex={preset}
              waitingMode={!!(state && !state.started)}
              waitingPreset={waitingPreset}
              cameraLerp={0.025}

              placementOverrides={placements}

              indexRotation={270}
              pathDirection="counterclockwise"
              displayOffset={0}

              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              onOpenTradeModal={() => setIsSelectingTradePlayer(true)}
              onInitiateTrade={openTrade}
              tradeActive={tradeState.isOpen}
              tradePlayerIds={me ? [me.id, tradeState.otherPlayerId] : []}

              //default states
              onBuyHouse={() => alert('Ev Al tıklandı')}
              onSellHouse={() => alert('Ev Sat tıklandı')}
              onBuyHotel={() => alert('Otel Al tıklandı')}
              onSellHotel={() => alert('Otel Sat tıklandı')}
              onMortgage={() => alert('İpotek Yap tıklandı')}
              onOptions={() => alert('Seçenekler tıklandı')}



              routeCompleteDelayMs={500} routeStartDelayMs={state?.lastDice ? 3200 : 0}
              currentPlayerId={state?.order?.[state?.turnIndex ?? 0]}
              activityKey={activityTick}
              showHud={!!state?.started}
              overlayChildren={state?.lastDice && !getDevFlag('disableDice') ? (
                <DiceSlots
                  d1={state.lastDice.d1 as 1 | 2 | 3 | 4 | 5 | 6}
                  d2={state.lastDice.d2 as 1 | 2 | 3 | 4 | 5 | 6}
                  trigger={rollTick}
                  align="center"
                  size={30}
                />
              ) : null}
              onCardRectsChange={useCallback((map: Record<string, DOMRect>) => {
                setCardRects(prev => {
                  const a = Object.keys(prev), b = Object.keys(map)
                  if (a.length !== b.length) return map
                  for (const k of b) {
                    const r1 = prev[k] as any, r2 = map[k] as any
                    if (!r1 || !r2) return map
                    const eps = 0.5
                    if (Math.abs(r1.left - r2.left) > eps || Math.abs(r1.top - r2.top) > eps || Math.abs(r1.width - r2.width) > eps || Math.abs(r1.height - r2.height) > eps) return map
                  }
                  return prev
                })
              }, [])}
              onTokenRouteStart={(pid) => {
                if (pid === meId) {
                  setAnimatingRoute(true);
                  setAnimatingMyMove(true);           // ΓåÉ add this
                }
              }}
              onTokenRouteComplete={({ playerId, tileIndex }: { playerId: string; tileIndex: number }) => {
                if (playerId === meId) {
                  setAnimatingRoute(false);
                  setAnimatingMyMove(false);
                  try { send({ type: 'arrived' } as any); armSuppress(400) } catch { }
                  flushTransfers();          // ΓåÉ add this

                  // If we deferred opening the modal during the hop, open it now (+100ms)
                  const t = pendingBuyTileRef.current;
                  if (t != null) {
                    pendingBuyTileRef.current = null;
                    if (pendingBuyTimerRef.current) clearTimeout(pendingBuyTimerRef.current as any);
                    pendingBuyTimerRef.current = window.setTimeout(() => {
                      setBuyModal({ tile: t, progress: 0 });
                    }, 100);
                  }

                  // If we landed on an unowned buyable tile (e.g., via a card move), open buy.tsx
                  try {
                    const sp: any = (board as any).spaces?.[tileIndex]
                    const ttype = sp?.type
                    const isBuyable = ttype === 'PROPERTY' || ttype === 'STATION' || ttype === 'UTILITY'
                    if (isBuyable) {
                      const hasOwner = Object.values(state?.players || {}).some((pl: any) => (pl?.properties || []).includes(sp.id))
                      if (!hasOwner) {
                        if (pendingBuyTimerRef.current) clearTimeout(pendingBuyTimerRef.current as any)
                        pendingBuyTimerRef.current = window.setTimeout(() => {
                          setBuyModal({ tile: tileIndex, progress: 0 })
                        }, 100) as any
                      }
                    }
                  } catch { }
                }
              }}

              showLabels={false}
              showFallbackSpheres={true}

            >
              {state?.lastDice && !getDevFlag('disableDice') && (
                <Suspense fallback={null}
                >
                  <DiceRoll
                    key={`dice-${state.lastDice.d1}-${state.lastDice.d2}-${rollTick}`}
                    d1={state.lastDice.d1}
                    d2={state.lastDice.d2}
                    position={[0, 0, 0]}
                    scale={6.5}
                    rotation={diceRotation}
                    trigger={rollTick}
                    mode={isMyTurn ? 'roller' : 'spectator'}
                    castShadows={!getDevFlag('disableDiceShadows')}
                    onFinished={() => { try { setDicePlaying(false) } catch { } }}
                  />
                </Suspense>
              )}
            </Board3D>




            {/* Money animations overlay */}
            <MoneyFx ref={moneyFxRef as any} cardRects={cardRects} />
            {/* Auction overlay */}
            <AuctionOverlay
              state={state as any}
              meId={meId} // Use meId here
              accentColor={currentAccent}
              send={send}
              isFullscreen={isFullscreen}
            />
            {/* Pending action card: show after any hop completes */}
            {pendingCard && !anyAnimatingRoute && (() => {
              try {
                const deck = String(pendingCard.deck || '')
                const idx = Number(pendingCard.index || 0)
                const isChance = deck === 'chance'
                const frontUrl = isChance ? `/kamuFonuVeSans/sans${idx}.png` : `/kamuFonuVeSans/kamufonu${idx}.png`
                const backUrl = isChance ? '/kamuFonuVeSans/sansB.png' : '/kamuFonuVeSans/kamufonuB.png'
                const canContinueCard = !!isMyTurn
                return (
                  <ActionCardModal3D
                    frontUrl={frontUrl}
                    backUrl={backUrl}
                    onClose={() => { /* overlay unmounts when server clears pendingCard */ }}
                    onContinue={() => send({ type: 'continueCard' } as any)}
                    canContinue={canContinueCard}
                    accentColor={currentAccent}
                  />
                )
              } catch { return null }
            })()}
            {state?.started && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none', transition: 'opacity 240ms ease' }}>
                <GameButtons
                  canRoll={!!canRoll && isMyTurn && !animatingRoute}
                  canEndTurn={!!canEndTurn && isMyTurn && !animatingRoute && !auctionGraceActive}
                  showAuction={!!showAuction}
                  onRoll={handleRollClick}
                  onEndTurn={() => send({ type: 'endTurn' } as any)}
                  accentColor={(() => {
                    // Match PlayersStrip -> PlayerCard color assignment, which uses
                    // an 8-slot grid with centered offset to pick PLAYER_DOTS.
                    const currentId = state?.order?.[state?.turnIndex ?? 0]
                    const idxInOrder = currentId ? effectiveOrder.indexOf(currentId) : -1
                    if (idxInOrder < 0) return '#f59e0b'
                    const SLOTS = 8
                    const offset = Math.max(0, Math.floor((SLOTS - effectiveOrder.length) / 2))
                    const dotIndex = (offset + idxInOrder) % PLAYER_DOTS.length
                    return PLAYER_DOTS[dotIndex]
                  })()}
                />
              </div>
            )}
            {false && (
              <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(0,0,0,0.35)', color: '#fff', padding: '8px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', backdropFilter: getDevFlag('disableBackdropBlur') ? 'none' : 'blur(6px)' }}>
                  {canRoll && (
                    <button className="btn" onClick={handleRollClick}>Zar At</button>
                  )}
                  {showAuction ? null : (
                    canEndTurn ? (
                      <button className="btn" onClick={() => send({ type: 'endTurn' } as any)}>Sırayı Bitir</button>
                    ) : null
                  )}

                </div>
              </div>
            )}
            {/* Buy modal overlay - modern card */}
            {buyModal && buyRenderReady && !animatingMyMove && (() => {
              const sp: any = (board as any).spaces?.[buyModal.tile]
              if (!sp) return null

              // Accent color from explicit tile mapping; fallback per type
              const tileId = buyModal.tile
              const accent =
                BUY_ACCENT_BY_TILE[tileId] ??
                (sp?.type === 'STATION'
                  ? '#0F0F0F'
                  : sp?.type === 'UTILITY'
                    ? '#98A496'
                    : '#6366f1')


              const price = Number(sp?.price || 0)
              const playerCash = me?.cash ?? 0
              const canBuyNow = playerCash >= price

              // Circular timer: same green ΓåÆ red color as the linear bar
              const remaining = Math.max(0, Math.min(1, 1 - (buyModal.progress ?? 0))) // 1 ΓåÆ 0
              const secondsLeft = Math.ceil(remaining * 30)
              const angle = Math.round(remaining * 360) // arc length
              const hue = Math.round(120 * remaining)   // 120 (green) ΓåÆ 0 (red)
              const ringColor = `hsl(${hue} 80% 48%)`
              const ringBg = `conic-gradient(${ringColor} ${angle}deg, rgba(255,255,255,0.15) 0deg)`


              const doBuy = () => closeBuyModal(() => send({ type: 'buy' } as any))
              const doAuction = () => closeBuyModal(() => send({ type: 'decline' } as any))

              const glass = 'rgba(17,24,39,0.60)' // slate-900 @60%
              const border = '1px solid rgba(255,255,255,0.14)'

              const solidBtn = (enabled: boolean): React.CSSProperties => ({
                flex: 1,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.14)',
                background: enabled
                  ? `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.07) 70%)`
                  : 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontWeight: 800,
                letterSpacing: 0.2,
                cursor: enabled ? 'pointer' : 'not-allowed',
                boxShadow: enabled ? '0 6px 24px rgba(0,0,0,0.35)' : 'none',
                transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
                opacity: enabled ? 1 : 0.65
              })

              const ghostBtn: React.CSSProperties = {
                flex: 1,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontWeight: 800,
                letterSpacing: 0.2,
                cursor: 'pointer',
                transition: 'transform 120ms ease, box-shadow 120ms ease',
              }

              return (
                // NEW overlay that fills the 3D panel and centers the card
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 60,
                    display: 'grid',
                    placeItems: 'center',
                    pointerEvents: 'none', // ΓåÉ let the 3D canvas keep receiving input outside the card
                  }}
                >
                  {/* Your card stays the same, but add pointerEvents:'auto' so it-s clickable */}
                  <div
                    onWheel={forwardWheelToCanvas}
                    style={{
                      width: 'auto',
                      borderRadius: 16,
                      overflow: 'hidden',
                      color: '#fff',
                      background: 'rgba(17,24,39,0.60)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      boxShadow: '0 10px 42px rgba(0,0,0,0.35)',
                      pointerEvents: 'auto',
                      opacity: buyVisible ? 1 : 0,
                      transform: buyVisible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
                      transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
                      willChange: 'opacity, transform',
                    }}
                  >


                    <div
                      style={{
                        width: 380,
                        borderRadius: 16,
                        overflow: 'hidden',
                        color: '#fff',
                        background: glass,
                        border,
                        boxShadow: '0 10px 42px rgba(0,0,0,0.35)',
                        backdropFilter: getDevFlag('disableBackdropBlur' as any) ? 'none' : 'blur(10px)'
                      }}
                    >
                      {/* Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 12,
                          background: `linear-gradient(90deg, ${accent} 0%, rgba(255,255,255,0.10) 100%)`,
                          borderBottom: '1px solid rgba(255,255,255,0.14)'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 16, lineHeight: '20px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {sp.name}
                          </div>
                          <div style={{ opacity: 0.85, fontSize: 12 }}>
                            {sp.type === 'PROPERTY' ? 'Mülk' : sp.type === 'STATION' ? 'İstasyon' : sp.type === 'UTILITY' ? 'Kamu Hizmeti' : 'Satın alınabilir'}
                          </div>
                        </div>
                        {/* radial countdown */}
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: '9999px',
                            background: ringBg,
                            display: 'grid',
                            placeItems: 'center',
                            willChange: 'background'
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '9999px',
                              background: 'rgba(0,0,0,0.55)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 900,
                              fontSize: 12,
                              boxShadow: `0 0 0 2px ${ringColor}22 inset`
                            }}
                          >
                            {secondsLeft}s
                          </div>
                        </div>

                      </div>

                      {/* Body */}
                      <div style={{ display: 'flex', gap: 12, padding: 12 }}>
                        <div style={{ flex: '0 0 auto' }}>
                          <PropertyCard id={buyModal.tile} side={'f'} width={140} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span style={{ opacity: 0.9 }}>Tapu Senedinin Fiyatı:</span>
                                <span style={{ fontWeight: 800, fontSize: 20 }}>{price}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span style={{ opacity: 0.9 }}>Elinde olan para:
                                </span>
                                <span style={{ fontWeight: 1000, fontSize: 20, color: canBuyNow ? '#34d399' : '#f87171' }}>{playerCash}</span>
                              </div>
                            </div>

                            {/* <div style={{ display: 'flex', flexDirection: 'column', margin: 'auto', gap: 10, marginTop: 2 }}>
                              <MetallicActionButton
                                label={canBuyNow ? 'Satın Al' : 'Yetersiz Bakiye'}
                                icon={<DollarSign size={18} />}
                                onClick={doBuy}
                                accentColor={currentAccent}
                                disabled={!canBuyNow}
                              />
                              <MetallicActionButton
                                label={'Açık Arttırma'}
                                icon={<Gavel size={18} />}
                                onClick={doAuction}
                                accentColor={currentAccent}
                              />
                            </div> */}

                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                                margin: 'auto',
                                marginTop: 2,
                                width: 'max-content',     // <- container becomes as wide as the widest child
                                alignItems: 'stretch',     // <- children can take that width
                              }}
                            >
                              <MetallicActionButton
                                label={canBuyNow ? 'Satın Al' : 'Yetersiz Bakiye'}
                                icon={<BanknoteArrowUp size={18} />}
                                onClick={doBuy}
                                accentColor={currentAccent}
                                disabled={!canBuyNow}
                                iconGap={0}
                              />
                              <MetallicActionButton
                                label={'Açık Arttırma'}
                                icon={<RiAuctionLine size={18} />}
                                onClick={doAuction}
                                accentColor={currentAccent}
                                iconGap={10}
                              />
                            </div>


                            {/* Countdown bar: full ΓåÆ 0 with smooth transform and solid color shift */}
                            {(() => {
                              const remaining = Math.max(0, Math.min(1, 1 - (buyModal.progress ?? 0))) // 1ΓåÆ0
                              const hue = Math.round(120 * remaining) // 120=green ΓåÆ 0=red
                              const barColor = `hsl(${hue} 80% 48%)`

                              const track: React.CSSProperties = {
                                position: 'relative',
                                height: 8,
                                background: 'rgba(255,255,255,0.10)',
                                borderRadius: 6,
                                overflow: 'hidden',
                                marginTop: 2,
                                border: '1px solid rgba(255,255,255,0.08)'
                              }

                              const fill: React.CSSProperties = {
                                position: 'absolute',
                                inset: 0,                  // full size; we scale it
                                background: barColor,      // solid color (no gradient)
                                transform: `scaleX(${remaining})`,
                                transformOrigin: 'left center',
                                transition: 'transform 180ms cubic-bezier(0.22,1,0.36,1), background-color 140ms linear',
                                willChange: 'transform',
                                backfaceVisibility: 'hidden'
                              }

                              return (
                                <div style={track} aria-label="Kalan süre">
                                  <div style={fill} />
                                </div>
                              )
                            })()}
                          </div>



                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </>
        )
        }
        {/* Optional property card overlay for current tile (dev toggle) */}
        {getDevFlag('showPropertyCard' as any) && (() => {
          const tile = me?.position ?? null
          if (tile == null) return null
          try {
            const sp: any = (board as any).spaces?.[tile]
            const t = sp?.type
            const isBuyable = t === 'PROPERTY' || t === 'STATION' || t === 'UTILITY'
            if (!isBuyable) return null
          } catch { }
          return (
            <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 20 }}>
              <PropertyCard id={tile} side={'f'} width={220} />
            </div>
          )
        })()}
        {/* In order mode, UI is minimal; no legacy buttons */}
        {false && isMyTurn}

        {state && isFullscreen && (
          <>
            {(() => {
              const order = state.order || []
              const styles: Array<any> = [
                { top: 12, left: 12 },
                { top: 12, right: 12 },
                { bottom: 12, left: 12 },
                { bottom: 12, right: 12 },
                { top: 12, left: '50%', transform: 'translateX(-50%)' },
                { bottom: 12, left: '50%', transform: 'translateX(-50%)' },
                { left: 12, top: '50%', transform: 'translateY(-50%)' },
                { right: 12, top: '50%', transform: 'translateY(-50%)' },
              ]
              const chip: any = { background: 'rgba(0,0,0,0.35)', color: '#fff', padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', backdropFilter: getDevFlag('disableBackdropBlur') ? 'none' : 'blur(6px)', fontSize: 12, zIndex: 3 }

            })()}
          </>
        )}
      </div>

      {isSelectingTradePlayer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center' }}>
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(350px, 90vw)',
            borderRadius: 16,
            boxShadow: '0 18px 80px rgba(0,0,0,0.5)',
            background: 'rgba(40,40,40,0.85)',
            backdropFilter: 'blur(10px)',
            color: '#fff',
            zIndex: 101,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            <h2 style={{ textAlign: 'center', margin: 0, fontSize: '20px' }}>Kiminle takas yapmak istersin?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {state?.order.filter(pid => pid !== meId).map(pid => (
                <button
                  key={pid}
                  onClick={() => {
                    openTrade(pid);
                    setIsSelectingTradePlayer(false);
                  }}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    textAlign: 'left'
                  }}
                >
                  {state.players[pid]?.name || 'Unknown Player'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsSelectingTradePlayer(false)}
              style={{
                marginTop: '10px',
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {tradeState.isOpen && (
        <TradeOverlay
          state={state as any}
          meId={meId} // Use meId here
          otherPlayerId={tradeState.otherPlayerId}
          send={send}
          onClose={closeTrade}
        />
      )}
    </main >
  )
}

























