export default {
  mounted(el: any) {
    const img = el.querySelector('img');
    if (img) {
      img.setAttribute('loading', 'lazy');
    }
  }
};