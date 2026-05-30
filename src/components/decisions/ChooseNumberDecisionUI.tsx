// src/components/decisions/ChooseNumberDecisionUI.tsx

import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { ChooseNumberDecision } from '@/types';
import { ManaSymbol } from '../ui/ManaSymbols';
import styles from './DecisionUI.module.css';

// ... (The parseManaDistributionPrompt function remains unchanged)
function parseManaDistributionPrompt(prompt: string): { firstColor: string; secondColor: string; total: number } | null {
    const match = prompt.match(/Choose how much \{(\w+)\} mana to add \(rest will be \{(\w+)\}\)\. Total: (\d+)/);
    if (!match?.[1] || !match?.[2] || !match?.[3]) return null;
    return { firstColor: match[1], secondColor: match[2], total: parseInt(match[3], 10) };
}

// ... (The ManaDistributionUI component remains unchanged)
function ManaDistributionUI({ /* ... */ }) { /* ... */ }

/**
 * Choose number decision - select a number from a range.
 */
export function ChooseNumberDecisionUI({ decision }: { decision: ChooseNumberDecision }) {
  // --- HOOKS MOVED TO TOP LEVEL ---
  const [selectedNumber, setSelectedNumber] = useState(decision.minValue);
  const submitNumberDecision = useGameStore((s) => s.submitNumberDecision);
  const manaDistribution = useMemo(() => parseManaDistributionPrompt(decision.prompt), [decision.prompt]);
  // ---------------------------------

  const handleConfirm = () => {
    submitNumberDecision(selectedNumber);
  };

  // --- CONDITIONAL RENDER ---
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

  // --- DEFAULT NUMBER SELECTION UI ---
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
