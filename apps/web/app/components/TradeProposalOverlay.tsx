"use client"

import React, { useMemo } from 'react';
import type { Player } from '@shared/types';
import PlayerCard from './PlayerCard';
import { MetallicActionButton } from './GameButtons';
import { Check, X } from 'lucide-react';
import { HiArrowSmRight } from "react-icons/hi";
import MonopolyMoney from './icons/MonopolyMoney';
import { PLAYER_DOTS } from './playerColors';
import { nameOf, isMortgaged } from './propertyTemplate';

export type TradeProposal = {
  id: string;
  from: string | null;    // proposer id
  to: string | null;      // recipient id
  moneyToGive: number;    // amount proposer gives
  propertiesToGive: number[]; // properties proposer gives
  moneyToGet: number;     // amount proposer requests from recipient
  propertiesToGet: number[];  // properties proposer requests from recipient
};

type Props = {
  players: Record<string, Player>;
  order: string[];
  meId: string | null;
  proposal: TradeProposal;
  onAccept: (p: TradeProposal) => void;
  onDecline: (p: TradeProposal) => void;
  onCounter: (p: TradeProposal) => void;
  isFullscreen?: boolean;
  // Optional absolute timestamp (ms) when the 15s response window ends
  expiresAt?: number;
};

export default function TradeProposalOverlay({ players, order, meId, proposal, onAccept, onDecline, onCounter, isFullscreen, expiresAt }: Props) {
  if (!players || !order || !meId || !proposal) return null;

  const fromPlayer = players[proposal.from ?? ''];
  const toPlayer = players[proposal.to ?? ''];
  if (!fromPlayer || !toPlayer) return null;

  const me = players[meId];
  const other = meId === proposal.from ? toPlayer : fromPlayer;
  const isRecipient = meId === proposal.to;

  const playerIdToSlotIndexMap = useMemo(() => {
    const SLOTS = 8;
    const playerList = order.map(id => players[id]).filter(Boolean);
    const offset = Math.max(0, Math.floor((SLOTS - playerList.length) / 2));
    const map = new Map<string, number>();
    for (let i = 0; i < playerList.length; i++) {
      const slotIndex = i + offset;
      const pid = playerList[i].id;
      if (slotIndex < SLOTS) { map.set(pid, slotIndex); }
    }
    return map;
  }, [order, players]);

  const myColor = PLAYER_DOTS[(playerIdToSlotIndexMap.get(me.id) ?? 0) % PLAYER_DOTS.length];
  const otherColor = PLAYER_DOTS[(playerIdToSlotIndexMap.get(other.id) ?? 0) % PLAYER_DOTS.length];

  // Map the proposal into viewer-centric values
  const viewMoneyToGive = isRecipient ? proposal.moneyToGet : proposal.moneyToGive;
  const viewMoneyToGet = isRecipient ? proposal.moneyToGive : proposal.moneyToGet;
  const viewPropsToGive = isRecipient ? proposal.propertiesToGet : proposal.propertiesToGive;
  const viewPropsToGet = isRecipient ? proposal.propertiesToGive : proposal.propertiesToGet;

  const scaleValue = isFullscreen ? 1 : 0.50;
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: isFullscreen ? '40%' : '40%',
    left: '50%',
    transform: `translate(-50%, -50%) scale(${scaleValue})`,
    zIndex: 120,
    width: isFullscreen ? 'min(900px, 92vw)' : 'min(900px, 92vw)',
    borderRadius: 16,
    overflow: 'visible',
    boxShadow: '0 18px 80px rgba(0,0,0,0.5)',
    background: 'rgba(25, 30, 45, 0.9)',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    padding: '20px',
  };
  const [now, setNow] = React.useState<number>(Date.now());
  React.useEffect(() => {
    if (!expiresAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 200) as any;
    return () => clearInterval(t);
  }, [expiresAt]);
  const remainingSec: number | null = (() => {
    if (!expiresAt) return null;
    const m = Math.max(0, expiresAt - now);
    return Math.ceil(m / 1000);
  })();

  const columnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    alignItems: 'center',
  };

  const moneyInputContainerStyle: React.CSSProperties = {
    width: isFullscreen ? '40%' : '50%',
    padding: '10px 15px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '0 auto',
    opacity: 0.8,
  };
  const moneyInputStyle: React.CSSProperties = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    textAlign: 'center',
    fontSize: '18px',
    width: '100%',
  };
  const sliderStyle: React.CSSProperties = { width: '100%', pointerEvents: 'none' };

  const propertiesGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(20px, 1fr))',
    gap: isFullscreen ? '5px' : '5px',
    padding: isFullscreen ? '10px' : '10px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
    width: isFullscreen ? '100%' : '100%',
    flex: 1,
    minHeight: '100px',
    pointerEvents: 'none',
  };

  const propertyChipStyle = (id: number, owned: boolean, selected: boolean): React.CSSProperties => {
    // Keep visual cue; chips are non-interactive in proposal view
    const mort = isMortgaged(id);
    return {
      width: isFullscreen ? '100%' : '100%',
      height: isFullscreen ? '20px' : '20px',
      borderRadius: '4px',
      background: mort ? 'rgba(200,0,0,0.6)' : 'rgba(255,255,255,0.15)',
      opacity: owned ? (selected ? 1 : 1) : 0.2,
      border: selected ? '2px solid #fff' : '1px solid rgba(0,0,0,0.65)',
      cursor: 'default',
      position: 'relative',
    };
  };

  function TradeSelectedStacks({ leftIds, rightIds }: { leftIds: number[]; rightIds: number[] }) {
    const gridStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: '1fr 50px 1fr',
      alignItems: 'center',
      gap: 10,
      marginTop: 8,
      pointerEvents: 'none',
    };
    const leftStackStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 };
    const rightStackStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 };
    const arrowColStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 8 };
    const imgStyle: React.CSSProperties = { display: 'block', width: 'auto', maxWidth: 260, height: 'auto', borderRadius: 5 };
    const renderCard = (id: number) => {
      const imageUrl = `/PropertyViewTrading/${id}${isMortgaged(id) ? 'b' : 'f'}.png`;
      return <img key={id} src={imageUrl} alt={`Property card for ${nameOf(id)}`} style={imgStyle} />
    };
    return (
      <div style={gridStyle}>
        <div style={leftStackStyle}>{leftIds.map(renderCard)}</div>
        <div style={arrowColStyle}>
          {leftIds.length > 0 && <HiArrowSmRight size={34} color="rgba(255,255,255,0.95)" style={{ transform: 'translateY(-6px)' }} />}
          {rightIds.length > 0 && <HiArrowSmRight size={34} color="rgba(255,255,255,0.95)" style={{ transform: 'translateY(6px)' }} />}
        </div>
        <div style={rightStackStyle}>{rightIds.map(renderCard)}</div>
      </div>
    );
  }

  // Owned set info only for visual reference (non-interactive)
  const renderProperties = (player: Player, selected: number[]) => {
    const ownedSet = new Set(player.properties);
    return (
      <div style={propertiesGridStyle}>
        {Array.from(ownedSet).map(id => {
          const isOwned = ownedSet.has(id);
          const isSelected = selected.includes(id);
          return (
            <div key={id} style={propertyChipStyle(id, isOwned, isSelected)} />
          );
        })}
      </div>
    );
  };

  return (
    <div style={panelStyle}>
      {isRecipient && remainingSec != null && (
        <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', padding: '4px 10px', borderRadius: 999, fontWeight: 800, zIndex: 999 }}>
          Yanıt süresi: {remainingSec}s
        </div>
      )}
      {/* LEFT COLUMN (Me) */}
      <div style={columnStyle}>
        <PlayerCard
          player={me}
          totalPlayers={order.length}
          orderIndex={playerIdToSlotIndexMap.get(me.id)}
          layoutScale={0.9}
          hideProperties={true}
        />

        <div style={{ width: '100%' }}>
          <div style={moneyInputContainerStyle}>
            <MonopolyMoney size={20} />
            <input type="number" style={moneyInputStyle} value={viewMoneyToGive} readOnly />
          </div>
          <input type="range" min={0} max={me.cash} value={Math.min(viewMoneyToGive, me.cash)} className="custom-slider" disabled style={{ ...sliderStyle, ['--slider-color' as any]: myColor }} />
        </div>

        {renderProperties(me, viewPropsToGive)}
      </div>

      {/* RIGHT COLUMN (Other) */}
      <div style={columnStyle}>
        <PlayerCard
          player={other}
          totalPlayers={order.length}
          orderIndex={playerIdToSlotIndexMap.get(other.id)}
          layoutScale={0.9}
          hideProperties={true}
        />

        <div style={{ width: '100%' }}>
          <div style={moneyInputContainerStyle}>
            <MonopolyMoney size={20} />
            <input type="number" style={moneyInputStyle} value={viewMoneyToGet} readOnly />
          </div>
          <input type="range" min={0} max={other.cash} value={Math.min(viewMoneyToGet, other.cash)} className="custom-slider" disabled style={{ ...sliderStyle, ['--slider-color' as any]: otherColor }} />
        </div>

        {renderProperties(other, viewPropsToGet)}
      </div>

      {/* Selected property cards in the middle */}
      <div style={{ gridColumn: 'span 2' }}>
        <TradeSelectedStacks leftIds={viewPropsToGive} rightIds={viewPropsToGet} />
      </div>

      {/* ACTIONS */}
      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
        <div style={{ width: 140 }}>
          <MetallicActionButton label="Reddet" icon={<X size={18} />} onClick={() => onDecline(proposal)} accentColor={myColor} />
        </div>
        <div style={{ width: 170 }}>
          <MetallicActionButton label="Karşı Teklif Yap" icon={<HiArrowSmRight size={18} />} onClick={() => onCounter(proposal)} accentColor={otherColor} />
        </div>
        <div style={{ width: 140 }}>
          <MetallicActionButton label="Kabul Et" icon={<Check size={18} />} onClick={() => onAccept(proposal)} accentColor={myColor} />
        </div>
      </div>
    </div>
  );
}
