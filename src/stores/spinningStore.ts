// src/stores/spinningStore.ts
import { defineStore } from 'pinia';

export const useSpinningStore = defineStore('spinning', {
  state: () => ({
    spinning: { show: false, tip: "" }
  }),
  actions: {
    toggleSpinning() {
      this.spinning.show = !this.spinning.show;
      this.spinning.tip = "";
    },
    setSpinning(show: boolean, tip: string = "") {
      this.spinning.show = show;
      this.spinning.tip = tip;
    }
  }
});
