// "use client"

// import React from 'react';
// import type { RoomState } from '@shared/types';
// import { nameOf } from './propertyTemplate';

// // Define a type for the trade proposal
// // NOTE: You'll need to make sure this matches your server state in `@shared/types`
// type TradeProposal = {
//     id: string;
//     from: string;
//     to: string;
//     moneyToGive: number;
//     propertiesToGive: number[];
//     moneyToGet: number;
//     propertiesToGet: number[];
// };

// export type TradeProposalOverlayProps = {
//     proposal: TradeProposal;
//     state: RoomState;
//     onAccept: (proposalId: string) => void;
//     onDecline: (proposalId: string) => void;
//     onCounter: (proposal: TradeProposal) => void;
// };

// export default function TradeProposalOverlay({ proposal, state, onAccept, onDecline, onCounter }: TradeProposalOverlayProps) {
//     const fromPlayer = state.players[proposal.from];
//     const toPlayer = state.players[proposal.to];

//     if (!fromPlayer || !toPlayer) return null;

//     const renderList = (items: (string | number)[]) => {
//         if (items.length === 0) return <li>None</li>;
//         return items.map((item, index) => <li key={index}>{item}</li>);
//     };

//     const youGiveItems = [
//         proposal.moneyToGet > 0 && `$${proposal.moneyToGet}`,
//         ...proposal.propertiesToGet.map(nameOf)
//     ].filter(Boolean);

//     const youGetItems = [
//         proposal.moneyToGive > 0 && `$${proposal.moneyToGive}`,
//         ...proposal.propertiesToGive.map(nameOf)
//     ].filter(Boolean);

//     return (
//         <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'grid', placeItems: 'center' }}>
//             <div style={{
//                 width: 'min(450px, 90vw)',
//                 borderRadius: 16,
//                 boxShadow: '0 18px 80px rgba(0,0,0,0.6)',
//                 background: 'rgba(30,30,30,0.9)',
//                 backdropFilter: 'blur(12px)',
//                 color: '#fff',
//                 padding: '25px',
//                 display: 'flex',
//                 flexDirection: 'column',
//                 gap: '20px',
//                 border: '1px solid rgba(255,255,255,0.15)'
//             }}>
//                 <h2 style={{ textAlign: 'center', margin: 0, fontSize: '22px' }}>
//                     Trade Proposal from {fromPlayer.name}
//                 </h2>

//                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
//                     <div>
//                         <h3 style={{ margin: '0 0 10px 0', color: '#f87171' }}>You Give:</h3>
//                         <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
//                             {renderList(youGiveItems)}
//                         </ul>
//                     </div>
//                     <div>
//                         <h3 style={{ margin: '0 0 10px 0', color: '#4ade80' }}>You Get:</h3>
//                         <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
//                             {renderList(youGetItems)}
//                         </ul>
//                     </div>
//                 </div>

//                 <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '15px' }}>
//                     <button onClick={() => onDecline(proposal.id)} style={{ padding: '10px 20px', borderRadius: '8px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
//                         Decline
//                     </button>
//                     <button onClick={() => onCounter(proposal)} style={{ padding: '10px 20px', borderRadius: '8px', background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
//                         Counter
//                     </button>
//                     <button onClick={() => onAccept(proposal.id)} style={{ padding: '10px 20px', borderRadius: '8px', background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
//                         Accept
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// }