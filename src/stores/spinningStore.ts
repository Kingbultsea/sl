// src/stores/spinningStore.ts
import { defineStore } from 'pinia';
import axios from "axios";

export const useSpinningStore = defineStore('spinning', {
  state: () => ({
    spinning: { show: false, tip: "" },
    isInWhiteList: false
  }),
  actions: {
    toggleSpinning() {
      this.spinning.show = !this.spinning.show;
      this.spinning.tip = "";
    },
    setSpinning(show: boolean, tip: string = "") {
      this.spinning.show = show;
      this.spinning.tip = tip;
    },
    setWhiteListStatus(status: boolean) {
      this.isInWhiteList = status;
    },
    fetchWhiteListStatus() {
      axios.get('/get-ip')
        .then((res) => {
          this.setWhiteListStatus(res.data.isInWhiteList);
        })
        .catch((error) => {
          console.error('获取白名单状态失败', error);
        });
    },
  }
});
