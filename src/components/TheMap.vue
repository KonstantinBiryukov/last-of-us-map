<template>
    <div id="map">
        <div class="card">
            <DescriptionCard v-if="showCard"></DescriptionCard>
        </div>
    </div>
</template>

<script>
    import store from "../store/index"
    import DescriptionCard from '@/components/DescriptionCard';
    import Velocity from "velocity-animate"

    export default {
        name: 'TheMap',
        components: {
            DescriptionCard
        },
        data() {
            return {
                cardId: "0",
            }
        },
        computed: {
            map() {
                return store.getters.createMap("map");
            },
            showCard() {
                return store.state.currentCard;
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

            // store.dispatch('fetchMarkers');
        },
        methods: {}
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
        cursor: help;
    }
</style>