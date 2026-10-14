/** Taxallusi (@username) yo'q foydalanuvchilarga bir martalik to'ldirish — deploy'da db-prepare chaqiradi */
import { backfillUsernames } from "../src/lib/chat/username";

backfillUsernames()
  .then((n) => {
    if (n > 0) console.log(`✓ ${n} ta foydalanuvchiga chat taxallusi berildi`);
    else console.log("✓ Chat taxalluslari joyida");
    process.exit(0);
  })
  .catch((e) => {
    console.error("✗ Taxallus backfill xatosi:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
