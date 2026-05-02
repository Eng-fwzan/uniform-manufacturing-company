export type InventoryBalanceMovement = {
  movement_type: string;
  quantity: number;
};

export type InventoryBalanceSummary = {
  physicalBalance: number;
  reservedQuantity: number;
  availableBalance: number;
};

export function summarizeInventoryMovements(
  movements: InventoryBalanceMovement[],
): InventoryBalanceSummary {
  const totals = movements.reduce(
    (summary, movement) => {
      const quantity = Number(movement.quantity);

      if (movement.movement_type === "in" || movement.movement_type === "adjustment") {
        summary.physicalBalance += quantity;
      } else if (movement.movement_type === "out") {
        summary.physicalBalance -= quantity;
      } else if (movement.movement_type === "reservation") {
        summary.reservedQuantity += quantity;
      } else if (movement.movement_type === "reservation_release") {
        summary.reservedQuantity -= quantity;
      }

      return summary;
    },
    { physicalBalance: 0, reservedQuantity: 0 },
  );

  const reservedQuantity = Math.max(totals.reservedQuantity, 0);

  return {
    physicalBalance: totals.physicalBalance,
    reservedQuantity,
    availableBalance: totals.physicalBalance - reservedQuantity,
  };
}