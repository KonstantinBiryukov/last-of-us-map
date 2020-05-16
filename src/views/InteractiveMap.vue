<template>
    <div class="map">
        <Map :interactive="true"></Map>
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
            let elements = document.getElementsByClassName("markers");
            elements.forEach(element => element.parentNode.removeChild(element));

            // while (elements.length > 0) {
            //     elements[0].parentNode.removeChild(elements[0]);
            // }
            store.state.map = null;
        }
    }
</script>
