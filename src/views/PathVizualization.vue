<template>
    <div class="path">
        <!--<PathCardsConveyor>-->
        <!--</PathCardsConveyor>-->
        <PathCardFlux>
        </PathCardFlux>
        <TheMap :interactive="false">
        </TheMap>
    </div>
</template>

<script>
    // @ is an alias to /src
    // import ThePath from '@/components/ThePath';
    import TheMap from '@/components/TheMap';
    // import PathCardsConveyor from '@/components/PathCardsConveyor';
    import PathCardFlux from '@/components/PathCardFlux';

    import store from "../store/index"

    export default {
        name: 'PathViz',
        data() {
            return {
                timer: null,
                timeout: null,
                i: 0
            }
        },
        components: {
            TheMap,
            // PathCardsConveyor,
            PathCardFlux
        },
        // mounted () {
        //     loop()
        // },
        mounted() {
            // To retrieve path with coordinates, send API request by draw a route: https://docs.mapbox.com/playground/directions/
            store.dispatch('fetchPathCards');

            store.state.map.on('load', () => {
                    store.state.map.setStyle('mapbox://styles/mapbox/satellite-streets-v11?optimized=true');

                    // this.first(2000).then(this.first(3500));
                    // this.first(3500).then(() => console.log("after3.5"));

                    // this.first(1000).then(() => this.first(2500));

                    // // disable page scroll
                    // $('html, body').css({
                    //     overflow: 'hidden',
                    //     height: '100%'
                    // });
                    // disable map zoom when using scroll
                    // store.state.map.scrollZoom.disable();


                    this.timeout = setTimeout(() => {
                        fetch('server/info/test2.geojson')
                            .then(response => response.json())
                            .then((data) => {
                                    // console.log(data.features[0].geometry.coordinates);
                                    // save full coordinate list for later
                                    // const coordinates = data.features[0].geometry.coordinates;
                                    const coordinates = data.features[0].geometry.coordinates;
                                    const coordinates2 = data.features[1].geometry.coordinates;
                                    const coordinates3 = data.features[2].geometry.coordinates;
                                    const coordinates4 = data.features[3].geometry.coordinates;

                                    console.log(data);
                                    // start by showing just the first coordinate
                                    // data.features[0].geometry.coordinates = [coordinates[0]];
                                    data.features[0].geometry.coordinates = [coordinates[0]];
                                    data.features[1].geometry.coordinates = [coordinates2[0]];
                                    data.features[2].geometry.coordinates = [coordinates3[0]];
                                    data.features[3].geometry.coordinates = [coordinates4[0]];

                                    // add it to the map
                                    store.state.map.addSource('trace', {type: 'geojson', data: data});
                                    store.state.map.addLayer({
                                        'id': 'trace',
                                        'type': 'line',
                                        'source': 'trace',
                                        'paint': {
                                            // 'line-color': 'red',
                                            'line-opacity': 0.75,
                                            // 'line-width': 7,
                                            'line-color': {
                                                type: 'categorical',
                                                property: 'color',
                                                stops: [
                                                    ['red', 'red'],
                                                    ['green', 'green'],
                                                    ['blue', 'blue'],
                                                    ['yellow', 'yellow'],
                                                ]
                                            },
                                            'line-width': {
                                                type: 'categorical',
                                                property: 'line-width',
                                                stops: [
                                                    ['7', 7],
                                                    ['0', 0],
                                                ]

                                            }


                                        }
                                        // 'layout': {
                                        //     'visibility': 'none'
                                        //     //     {
                                        //     //     type: 'categorical',
                                        //     //     property: 'visibility',
                                        //     //     stops: [
                                        //     //         ['visible', 'visible'],
                                        //     //         ['none', 'none'],
                                        //     //     ]
                                        //     // }
                                        // }
                                    });

                                    // setup the viewport
                                    store.state.map.flyTo({'center': coordinates[0], 'zoom': 6, 'speed': 0.5});
                                    store.state.map.setPitch(10);

                                    // on a regular basis, add more coordinates from the saved list and update the map
                                    let i = 0;
                                    let j = 0;
                                    let k = 0;
                                    let l = 0;

                                    let delay = 75;
                                    let outer = this;
                                    // console.log(data.features[0].geometry.coordinates);
                                    // this.timer = window.setInterval(function request() {
                                    this.timer = window.setTimeout(function request() {

                                        if (i < coordinates.length) {

                                            // window.clearInterval(this.timer);
                                            // this.timer = window.setInterval(() => {
                                            // this.timer = window.setInterval(() => {

                                            // if (i < 332) { // 334
                                            data.features[0].geometry.coordinates.push(
                                                coordinates[i]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates[i]);
                                            i++;
                                            store.state.map.flyTo({
                                                'center': coordinates[i],
                                                'zoom': 10, // 10
                                                'speed': 0.3 // 0.6
                                            }); // z8 s0.2
                                            outer.timer = setTimeout(request, delay);

                                            // }, 2000); // 75
                                        } else if (j < coordinates2.length) {
                                            // if (j === 0) {
                                            //     delay += 300;
                                            // }

                                            data.features[1].geometry.coordinates.push(
                                                coordinates2[j]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates2[j]);
                                            j++;

                                            store.state.map.flyTo({
                                                'center': coordinates2[j],
                                                'zoom': 7,
                                                'speed': 3
                                            }); // z8 s0.2

                                            // outer.timer = setTimeout(request, delay);
                                            outer.timer = setTimeout(request, delay);

                                        } else if (k < coordinates3.length) {
                                            if (k === 0) {
                                                delay = 60;
                                            }
                                            // clearInterval(this.timer);
                                            // setInterval(() => {
                                            data.features[2].geometry.coordinates.push(
                                                coordinates3[k]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates3[k]);
                                            k++;

                                            store.state.map.flyTo({
                                                'center': coordinates3[k],
                                                'zoom': 10,
                                                'speed': 0.5
                                            }); // z8 s0.2
                                            // }, 5); // 75

                                            outer.timer = setTimeout(request, delay);

                                        } else if (l < coordinates4.length) {
                                            if (l === 0) {
                                                delay = 0.05;
                                            }
                                            data.features[3].geometry.coordinates.push(
                                                coordinates4[l]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates4[l]);
                                            l++;

                                            store.state.map.flyTo({
                                                'center': coordinates4[l],
                                                'zoom': 7,
                                                'speed': 3
                                            }); // z8 s0.2
                                            outer.timer = setTimeout(request, delay);


                                            // } else {
                                            //     data.features[0].geometry.coordinates.push(
                                            //         coordinates[i]
                                            //     );
                                            //     store.state.map.getSource('trace').setData(data);
                                            //     store.state.map.panTo(coordinates[i]);
                                            //     i++;
                                            //
                                            //     store.state.map.setLayoutProperty('trace', 'visibility', 'none');
                                            //     store.state.map.flyTo({
                                            //         'center': coordinates[i],
                                            //         'zoom': 7,
                                            //         'speed': 0.4
                                            //     });
                                            // }

                                            // if (i > 100) {
                                            //     store.state.map.flyTo({'center': coordinates[i], 'zoom': 7, 'speed': 0.6});
                                            // }
                                            // if (i > 200) {
                                            //     store.state.map.flyTo({'center': coordinates[i], 'zoom': 9, 'speed': 0.8});
                                            // }
                                            // } else if (i === 334) {
                                            // } else if (i >= 332 && i <= 600) {
                                            //
                                            //     // console.log(store.state.map.setPaintProperty('trace', ));
                                            //     //
                                            //     data.features[0].geometry.coordinates.push(
                                            //         coordinates[i]
                                            //     );
                                            //     store.state.map.setLayoutProperty('trace', 'visibility', 'none');
                                            //
                                            //     // store.state.map.setPaintProperty('trace', 'line-opacity', 0);
                                            //     store.state.map.flyTo({'center': coordinates[i], 'zoom': 6, 'speed': 0.2});
                                            //     i++;
                                            //
                                            // } else if (i > 480) { //334
                                            //
                                            //     data.features[0].geometry.coordinates.push(
                                            //         coordinates[i]
                                            //     );
                                            //
                                            //     // store.state.map.setPaintProperty('trace', 'line-opacity', 0.75);
                                            //     // store.state.map.setLayoutProperty('trace2', 'visibility', 'visible');
                                            //     console.log("FEATURES: ");
                                            //     console.log(data.features[0].geometry.coordinates);
                                            //     console.log("DATA: ");
                                            //     console.log(data);
                                            //
                                            //     store.state.map.getSource('trace2').setData(data);
                                            //     store.state.map.panTo(coordinates[i]);
                                            //     i++;
                                            //
                                            //     store.state.map.flyTo({'center': coordinates[i], 'zoom': 12, 'speed': 0.5});
                                            //
                                            // }
                                        } else {
                                            window.clearInterval(this.timer);
                                            window.clearTimeout(this.timeout);
                                        }

                                        // }, 75); // 75
                                    }, delay);

                                    // this.timer = window.setInterval(() => { // Summer, 2033, Boston
                                    //     store.state.map.setPaintProperty('trace', 'line-opacity', 0);
                                    //
                                    //     if (i >= 332) {
                                    //         data.features[0].geometry.coordinates.push(
                                    //             coordinates[i]
                                    //         );
                                    //         i++;
                                    //         console.log("flyBoston " + i);
                                    //         store.state.map.flyTo({
                                    //             'center': coordinates[i],
                                    //             'zoom': 8,
                                    //             'speed': 0.15
                                    //         });
                                    //     } else {
                                    //         window.clearInterval(this.timer);
                                    //     }
                                    // }, 100); //400
                                    // this.timer = window.setInterval(() => { // Summer, 2033, Boston
                                    //     console.log("in Boston " + i);
                                    //
                                    //     if (i > 334) {
                                    //         data.features[0].geometry.coordinates.push(
                                    //             coordinates[i]
                                    //         );
                                    //         store.state.map.getSource('trace').setData(data);
                                    //         store.state.map.panTo(coordinates[i]);
                                    //         i++;
                                    //         store.state.map.flyTo({'center': coordinates[i], 'zoom': 8, 'speed': 0.2});
                                    //     } else {
                                    //         window.clearInterval(this.timer);
                                    //     }
                                    // }, 75);

                                    //
                                }
                            );
                    }, 3000);

                    // this.timeout = setTimeout(() => {
                    //     fetch('server/info/routes_boston.geojson')
                    //         .then(response => response.json())
                    //         .then((data) => {
                    //                 // save full coordinate list for later
                    //                 const coordinates = data.features[0].geometry.coordinates;
                    //                 console.log(coordinates);
                    //                 // start by showing just the first coordinate
                    //                 data.features[0].geometry.coordinates = [coordinates[0]];
                    //
                    //                 // add it to the map
                    //                 store.state.map.addSource('trace2', {type: 'geojson', data: data});
                    //                 store.state.map.addLayer({
                    //                     'id': 'trace2',
                    //                     'type': 'line',
                    //                     'source': 'trace2',
                    //                     'paint': {
                    //                         'line-color': 'green',
                    //                         'line-opacity': 0.75,
                    //                         'line-width': 7
                    //                     }
                    //                 });
                    //
                    //                 // setup the viewport
                    //                 store.state.map.flyTo({'center': coordinates[0], 'zoom': 10, 'speed': 0.5});
                    //                 store.state.map.setPitch(10);
                    //
                    //                 // on a regular basis, add more coordinates from the saved list and update the map
                    //                 let i = 0;
                    //
                    //                 this.timer = window.setInterval(() => {
                    //                     if (i < coordinates.length) {
                    //                         data.features[0].geometry.coordinates.push(
                    //                             coordinates[i]
                    //                         );
                    //                         store.state.map.getSource('trace2').setData(data);
                    //                         store.state.map.panTo(coordinates[i]);
                    //                         i++;
                    //
                    //                         store.state.map.flyTo({'center': coordinates[i], 'zoom': 12, 'speed': 0.15}); // z8 s0.2
                    //                     } else {
                    //                         window.clearInterval(this.timer);
                    //                     }
                    //
                    //                 }, 75); // 75
                }
            );
            // }, 30000);
            // }
            // );
            // }

        },
        beforeDestroy() {
            //  Cleanup interval
            clearInterval(this.timer);
            //  Cleanup any pending timeouts
            clearTimeout(this.timeout);
        }
        // methods: {
        //     first(ms) {
        //         return new Promise(resolve => {
        //             setTimeout(() => resolve(), ms);
        //         });
        //     },
        //     second(x) {
        //         return new Promise(() => {
        //             console.log(x);
        //         })
        //     }
        // }

    }
</script>

<style scoped>

</style>
