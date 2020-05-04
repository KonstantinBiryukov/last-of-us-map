<template>
    <div id="map">
        <div class="card">
            <DescriptionCard :name="cardTitle"></DescriptionCard>
            <!--<div class="marker" v-for="marker in markers"></div>-->
        </div>
    </div>
</template>


<script>
    import store from "../store/index"
    import DescriptionCard from '@/components/DescriptionCard';

    export default {
        name: 'Mapbox',
        components: {
            DescriptionCard
        },
        data() {
            return {
                cardTitle: "1"
            }
        },
        computed: {
            map() {
                return store.getters.createMap("map");
            }
        },
        mounted() {
            // set up bounds and center
            const bounds = [
                [-126.5, 24.5], // [west, south]
                [-65.5, 49.5]  // [east, north]
            ];
            const center = [-97, 40];
            this.map.setMaxBounds(bounds);
            this.map.setCenter(center);

            store.getters.fetchMarkers;

        },
        methods: {
            addCard(el, marker) {
                window.alert(marker.properties.message);
            }
        }
    }
</script>

<style>
    #map {
        position: absolute;
        top: 15vh;
        bottom: 0;
        width: 100%;
    }

    .marker {
        background-size: cover;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        cursor: pointer;
    }
</style>