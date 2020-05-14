<template>
    <vue-flux
            :options="vfOptions"
            :images="vfImages"
            :transitions="vfTransitions"
            :captions="vfCaptions"
            ref="slider">

        <template v-slot:preloader>
            <flux-preloader />
        </template>

        <template v-slot:caption>
            <flux-caption />
        </template>

        <template v-slot:controls>
            <flux-controls />
        </template>

        <template v-slot:pagination>
            <flux-pagination />
        </template>

        <template v-slot:index>
            <flux-index />
        </template>
    </vue-flux>

    <button @click="$refs.slider.show('next')">NEXT</button>

</template>

<script>
    import {
        VueFlux,
        FluxCaption,
        FluxControls,
        FluxIndex,
        FluxPagination,
        FluxPreloader
    } from 'vue-flux';

    export default {
        name: "PathCardsFlux",
        components: {
            VueFlux,
            FluxCaption,
            FluxControls,
            FluxIndex,
            FluxPagination,
            FluxPreloader,

        },
        data: () => ({
            vfOptions: {
                autoplay: true
            },
            vfImages: [ 'URL1', 'URL2', 'URL3' ],
            vfTransitions: [ 'fade', 'cube', 'book', 'wave' ],
            vfCaptions: [
                'Caption for image 1',
                'Caption for image 2',
                'Caption for image 3',
            ],
        }),

    }
</script>

<style scoped>

</style>