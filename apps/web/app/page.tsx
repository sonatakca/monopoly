'use client'

import { useEffect, useMemo, useState, useRef, Suspense } from 'react'
import { socket } from '../lib/socket'
import type { ServerEvent, ClientEvent, RoomState } from '@shared/types'
import Board3D, { type CameraPreset, type PlacementOverrides } from './components/Board3D'
import DiceGLB from './components/DiceGLB'
import RoomsList from './components/RoomsList'
const NAME_KEY = 'monopoly:name'
const PLACE_KEY = 'monopoly:placements'

/** === BAKED-IN PERMANENT PLACEMENTS (your JSON) === */
const PERMA_PLACEMENTS_RAW: Record<string, [number, number][]> = {
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

/** Jail offsets provided for the jail tile; we remap GO_TO_JAIL (30) to Jail (10) */
const PERMA_JAIL_RAW: Record<string, [number, number][]> = {
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

function buildPermanentPlacements(): PlacementOverrides {
  const out: PlacementOverrides = {}
  for (const [k, v] of Object.entries(PERMA_PLACEMENTS_RAW)) {
    const n = Number(k); if (!Number.isNaN(n)) out[n] = v as any
  }
  // 10 = Jail; 30 (Go To Jail) uses the same 8 slots
  if (PERMA_JAIL_RAW?.['0']) {
    out[10] = PERMA_JAIL_RAW['0']
    if (!out[30]) out[30] = out[10]
  }
  return out
}

export default function Home() {
  const [state, setState] = useState<RoomState & { ready?: Record<string, boolean>, adminId?: string } | null>(null)
  const [connected, setConnected] = useState<boolean>(socket.connected)
  const [err, setErr] = useState<string>('')

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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const prevScrollRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const prevSceneSizeRef = useRef<{ w: number; h: number } | null>(null)
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
      document.exitFullscreen?.().catch(() => {})
      ;(document as any).webkitExitFullscreen?.()
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
      el.requestFullscreen?.().catch(() => {})
      ;(el as any).webkitRequestFullscreen?.()
    }
  }

  // camera presets (FOV 56)
  const [preset, setPreset] = useState(0)
  const [presets] = useState<CameraPreset[]>([
    { pos: [8.5, 8.5, 8.5], target: [0, 0, 0], fov: 56 },
    { pos: [0.0, 8.5, 8.5], target: [0, 0, 0], fov: 56 },
    { pos: [-8.5, 8.5, 0.0], target: [0, 0, 0], fov: 56 },
    { pos: [0.0, 8.5, -8.5], target: [0, 0, 0], fov: 56 },
  ])
  const waitingPreset: CameraPreset = { pos: [0, 12, 0], target: [0, 0, 0], fov: 30 }

  // placements
  const PERMANENT = useMemo(buildPermanentPlacements, [])
  const [placements, setPlacements] = useState<PlacementOverrides>(PERMANENT)
  useEffect(() => {
    try {
      const existing = localStorage.getItem(PLACE_KEY)
      if (!existing) localStorage.setItem(PLACE_KEY, JSON.stringify(PERMANENT))
    } catch { }
  }, [PERMANENT])

  // dice animation trigger & url selection based on server dice outcome
  const [rollTick, setRollTick] = useState(0)
  // Rotate dice +90° around Y each throw
  const diceRotation = useMemo<[number, number, number]>(() => {
    const step = rollTick % 8
    const radians = (step * 45 * Math.PI) / 180
    return [0, radians, 0]
  }, [rollTick])
  const lastSeenKey = useRef<string | null>(null)
  const seededInitialFromFirstState = useRef(false)
  const localRollPending = useRef(false)
  const diceUrl = useMemo(() => {
    const d = state?.lastDice
    if (!d) return null // no fetch until first roll arrives
    const hi = Math.max(d.d1, d.d2)
    const lo = Math.min(d.d1, d.d2)
    return `/animations/dice ${hi}-${lo}.glb`
  }, [state?.lastDice])

  // Seed lastSeenKey from the very first server state (if it already has dice),
  // so we don't auto-play on initial load/refresh.
  useEffect(() => {
    if (!seededInitialFromFirstState.current && state) {
      seededInitialFromFirstState.current = true
      const d0 = state.lastDice
      if (d0) lastSeenKey.current = `${d0.d1}-${d0.d2}-${d0.isDouble}`
    }
  }, [state])
  useEffect(() => {
    const d = state?.lastDice
    if (!d) return
    const key = `${d.d1}-${d.d2}-${d.isDouble}`
    if (key !== lastSeenKey.current || localRollPending.current) {
      lastSeenKey.current = key
      localRollPending.current = false
      setRollTick(t => t + 1)
    }
  }, [state?.lastDice])

  function handleRollClick() {
    // Trigger server roll; mark local pending so we also replay if same pair repeats
    localRollPending.current = true
    send({ type: 'roll' } as any)
  }

  // socket
  useEffect(() => {
    const onConnect = () => { setConnected(true); setErr('') }
    const onDisconnect = () => setConnected(false)
    const onConnectError = (e: any) => { setErr(String(e?.message || e)); setConnected(false) }
    const onEvt = (evt: ServerEvent | any) => {
      if (evt.type === 'state') setState({ ...(evt.state as any) })
      if (evt.type === 'msg') console.log('[MSG]', evt.text)
      if (evt.type === 'error') alert(evt.text)
    }
    if (socket.connected) onConnect()
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('event', onEvt)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('event', onEvt)
    }
  }, [])

  // persist name
  useEffect(() => {
    const t = setTimeout(() => {
      try { if (name && name.trim()) localStorage.setItem(NAME_KEY, name.trim()) } catch { }
    }, 120)
    return () => clearTimeout(t)
  }, [name])

  function send(e: ClientEvent | any) { socket.emit('event', e) }

  const me = useMemo(() => state && socket.id ? state.players[socket.id] : null, [state])
  const isMyTurn = !!(state && state.order?.length && state.order[state.turnIndex] === socket.id)
  const isAdmin = !!(state && (state as any).adminId === socket.id)
  const allReady = !!(state && state.order?.every(id => (state as any).ready?.[id]))

  return (
    <main style={{ padding: '24px 28px' }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>MonopolyTR (lobi + oyun)</h1>

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
            {((state as any)?.ready && socket.id && (state as any).ready[socket.id]) ? 'Hazır değilim' : 'Hazırım'}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => send({ type: 'start' })}
            disabled={!allReady || (state?.order?.length || 0) < 2}
            title="Herkes hazır olunca aktif"
          >
            Oyunu Başlat (Admin)
          </button>
        )}
        <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
          {connected ? `Bağlı (${socket.id})` : 'Bağlantı yok'} {err && `• ${err}`}
        </span>
      </section>

      {/* Public rooms */}
      <RoomsList onSelect={(rid) => setRoomId(rid)} onJoin={(rid) => send({ type: 'join', name: name.trim(), roomId: rid })} me={me} />

      {/* Players list + kick */}
      {state && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          {state.order.map(pid => {
            const p = state.players[pid]
            if (!p) return null
            const ready = (state as any).ready?.[pid]
            const isMe = pid === socket.id
            return (
              <div key={pid} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 8 }}>
                <b>{p.name}</b> — {p.cash}₺ — Poz: {p.position} {pid === (state as any).adminId && <em>(admin)</em>}
                <div style={{ fontSize: 12, opacity: 0.85 }}>{ready ? 'Hazır ✅' : 'Hazır değil ⏳'}</div>
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

      // Turn controls moved into 3D overlay\r\n{/* 3D board */}
      <div ref={scenePanelRef} style={{ marginTop: 12, position: 'relative' }}>
        <div className="r3f-toolbar" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setPreset(0)}>Kamera 1</button>
          <button onClick={() => setPreset(1)}>Kamera 2</button>
          <button onClick={() => setPreset(2)}>Kamera 3</button>
          <button onClick={() => setPreset(3)}>Kamera 4</button>
          <button onClick={toggleFullscreen}>{isFullscreen ? 'Pencere' : 'Tam Ekran'}</button>
        </div>
        <Board3D
          players={state?.players ?? {}}
          order={state?.order ?? []}
          boardImageUrl="/board.png"

          models={(() => {
            const ids = state ? Object.keys(state.players) : []
            const m: Record<string, any> = {}
            if (ids[0]) m[ids[0]] = { url: '/models/Property Types/House.stl', scale: 0.02, color: '#16a34a', rotation: [-Math.PI / 2, 0, 0], y: 0.18 }
            if (ids[1]) m[ids[1]] = { url: '/models/Property Types/Hotel.stl', scale: 0.02, color: '#dc2626', rotation: [-Math.PI / 2, 0, 0], y: 0.18 }
            return m
          })()}

          worldSize={10}
          outfill={0.08}
          boardThickness={0.3}
          rimHeight={0.05}
          rimColor="#000"
          lighting={{ ambient: 0.3, hemi: 0.2, key: 0.85, fill: 0.4, exposure: 1.0, background: '#e9edf0' }}

          presets={presets}
          presetIndex={preset}
          waitingMode={!!(state && !state.started)}
          waitingPreset={waitingPreset}
          cameraLerp={0.025}

          placementOverrides={placements}
          placementAliases={{ 30: 10 }}

          indexRotation={0}
          pathDirection="clockwise"
          displayOffset={0}

          showLabels={false}
          showFallbackSpheres={false}
        >
          {diceUrl && (
            <Suspense fallback={null}>
              <DiceGLB
                key={`${diceUrl}-${rollTick}`}
                url={diceUrl}
                position={[0, 0, 0]}
                scale={8}
                rotation={diceRotation}
                playAll
                trigger={rollTick}
                onFinished={() => { /* no-op; hook if needed */ }}
              />
            </Suspense>
          )}
        </Board3D>
        {state && state.started && isMyTurn && (
          <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 8, background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: 10, backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)', zIndex: 2 }}>
            <button onClick={handleRollClick}>Zar At</button>
            <button onClick={() => send({ type: 'buy' })}>Satin Al</button>
            <button onClick={() => send({ type: 'decline' })}>Ihaleye Aç</button>
            <button onClick={() => send({ type: 'endTurn' })}>Sirayi Geç</button>
          </div>
        )}
      </div>
    </main>
  )
}
