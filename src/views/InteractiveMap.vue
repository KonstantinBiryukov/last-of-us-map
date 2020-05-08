<template>
    <div class="map">
        <Map></Map>
    </div>
</template>

<script>
    // @ is an alias to /src
    import Map from '@/components/TheMap';
    import store from "../store/index"


    export default {
        name: 'MainMap',
        components: {
            Map
        },
        mounted() {
            store.dispatch('fetchMarkers');
        },
        beforeDestroy() {
            store.state.currentCard = null;
        }
    }
</script>