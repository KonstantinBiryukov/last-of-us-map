<template>
    <div id="path">

    </div>
</template>

<script>
    import store from "../store/index"


    export default {
        name: "ThePath",
        computed: {
            map() {
                return store.getters.createMap("path");
            }
        },
        mounted() {
            // set up bounds and center
            // const bounds = [
            //     [-126.5, 24.5], // [west, south]
            //     [-65.5, 49.5]  // [east, north]
            // ];
            // const center = [-97, 40];
            // this.map.setMaxBounds(bounds);
            // this.map.setCenter(center);
        }
    }
</script>

<style>
    #path {
        position: absolute;
        top: 15vh;
        bottom: 0;
        width: 100%;
    }
</style>