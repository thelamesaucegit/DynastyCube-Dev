// src/components/decisions/ChooseNumberDecisionUI.tsx

import React, { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { ChooseNumberDecision } from '@/types';
import { ManaSymbol } from '../ui/ManaSymbols';
import styles from './DecisionUI.module.css';

function parseManaDistributionPrompt(prompt: string): { firstColor: string; secondColor: string; total: number } | null {
    const match = prompt.match(/Choose how much \{(\w+)\} mana to add \(rest will be \{(\w+)\}\)\. Total: (\d+)/);
    if (!match?.[1] || !match?.[2] || !match?.[3]) return null;
    return { firstColor: match[1], secondColor: match[2], total: parseInt(match[3], 10) };
}

/**
 * Mana distribution decision - specialized UI for choosing how to split mana
 */
function ManaDistributionUI({
  decision,
  firstColor,
  secondColor,
  total,
}: {
  decision: ChooseNumberDecision;
  firstColor: string;
  secondColor: string;
  total: number;
}) {
  const [firstAmount, setFirstAmount] = useState(0);
  const submitNumberDecision = useGameStore((s) => s.submitNumberDecision);
  const secondAmount = total - firstAmount;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFirstAmount(parseInt(e.target.value, 10));
  };

  const handleConfirm = () => {
    submitNumberDecision(firstAmount);
  };

  const renderManaRow = (color: string, count: number) => {
    if (count === 0) return <span style={{ color: '#666', fontSize: 14, fontStyle: 'italic' }}>None</span>;
    const symbols = [];
    for (let i = 0; i < count; i++) {
      symbols.push(<ManaSymbol key={i} symbol={color} size={28} />);
    }
    return <>{symbols}</>;
  };

  return (
    <>
      {decision.context.sourceName && <h2 className={styles.title}>{decision.context.sourceName}</h2>}
      <p style={manaDistStyles.subtitle}>Add {total} mana in any combination</p>
      <div style={manaDistStyles.previewContainer}>
        <div style={manaDistStyles.colorSection}>
          <div style={manaDistStyles.colorHeader}><ManaSymbol symbol={firstColor} size={22} /><span style={manaDistStyles.colorCount}>{firstAmount}</span></div>
          <div style={manaDistStyles.manaRow}>{renderManaRow(firstColor, firstAmount)}</div>
        </div>
        <div style={manaDistStyles.divider} />
        <div style={manaDistStyles.colorSection}>
          <div style={manaDistStyles.colorHeader}><ManaSymbol symbol={secondColor} size={22} /><span style={manaDistStyles.colorCount}>{secondAmount}</span></div>
          <div style={manaDistStyles.manaRow}>{renderManaRow(secondColor, secondAmount)}</div>
        </div>
      </div>
      <div style={manaDistStyles.sliderContainer}>
        <ManaSymbol symbol={secondColor} size={20} />
        <input type="range" min={0} max={total} value={firstAmount} onChange={handleSliderChange} style={manaDistStyles.slider} />
        <ManaSymbol symbol={firstColor} size={20} />
      </div>
      <div style={manaDistStyles.quickButtons}>
        <button onClick={() => setFirstAmount(0)} style={{ ...manaDistStyles.quickButton, ...(firstAmount === 0 ? manaDistStyles.quickButtonActive : {}) }}>All <ManaSymbol symbol={secondColor} size={14} /></button>
        {total > 1 && (<button onClick={() => setFirstAmount(Math.floor(total / 2))} style={{ ...manaDistStyles.quickButton, ...(firstAmount === Math.floor(total / 2) ? manaDistStyles.quickButtonActive : {}) }}>Split</button>)}
        <button onClick={() => setFirstAmount(total)} style={{ ...manaDistStyles.quickButton, ...(firstAmount === total ? manaDistStyles.quickButtonActive : {}) }}>All <ManaSymbol symbol={firstColor} size={14} /></button>
      </div>
      <button onClick={handleConfirm} className={styles.confirmButton}>Add Mana</button>
    </>
  );
}

const manaDistStyles: Record<string, React.CSSProperties> = {
  subtitle: { margin: '0 0 20px 0', color: '#999', fontSize: 14, textAlign: 'center' },
  previewContainer: { display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 16, marginBottom: 24, padding: '16px 12px', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.08)' },
  colorSection: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minHeight: 60 },
  colorHeader: { display: 'flex', alignItems: 'center', gap: 6 },
  colorCount: { fontSize: 24, fontWeight: 'bold', color: '#fff', minWidth: 24, textAlign: 'center' },
  manaRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4, minHeight: 28, alignItems: 'center' },
  divider: { width: 1, backgroundColor: 'rgba(255, 255, 255, 0.12)', alignSelf: 'stretch' },
  sliderContainer: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '0 8px' },
  slider: { flex: 1, height: 6, appearance: 'none', backgroundColor: '#333', borderRadius: 3, cursor: 'pointer', outline: 'none' },
  quickButtons: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 },
  quickButton: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', fontSize: 13, backgroundColor: 'rgba(255, 255, 255, 0.06)', color: '#bbb', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' },
  quickButtonActive: { backgroundColor: 'rgba(100, 160, 255, 0.15)', borderColor: 'rgba(100, 160, 255, 0.4)', color: '#fff' },
};


export function ChooseNumberDecisionUI({ decision }: { decision: ChooseNumberDecision }) {
  const [selectedNumber, setSelectedNumber] = useState(decision.minValue);
  const submitNumberDecision = useGameStore((s) => s.submitNumberDecision);
  const manaDistribution = useMemo(() => parseManaDistributionPrompt(decision.prompt), [decision.prompt]);

  const handleConfirm = () => {
    submitNumberDecision(selectedNumber);
  };

  if (manaDistribution) {
    return (
      <ManaDistributionUI
        decision={decision}
        firstColor={manaDistribution.firstColor}
        secondColor={manaDistribution.secondColor}
        total={manaDistribution.total}
      />
    );
  }

  const numbers = [];
  for (let i = decision.minValue; i <= decision.maxValue; i++) {
    numbers.push(i);
  }

  return (
    <>
      <h2 className={styles.title}>{decision.prompt}</h2>
      {decision.context.sourceName && (
        <p className={styles.subtitle}>{decision.context.sourceName}</p>
      )}
      <div className={styles.numberContainer}>
        {numbers.map((num) => (
          <button
            key={num}
            onClick={() => setSelectedNumber(num)}
            className={`${styles.numberButton} ${selectedNumber === num ? styles.numberButtonSelected : ''}`}
          >
            {num}
          </button>
        ))}
      </div>
      <button onClick={handleConfirm} className={styles.confirmButton}>
        Confirm
      </button>
    </>
  );
}
