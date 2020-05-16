<template>
    <div class="path">
        <PathCardsFlux>
        </PathCardsFlux>
        <TheMap :interactive="false">
        </TheMap>
    </div>
</template>

<script>
    // @ is an alias to /src
    import TheMap from '@/components/TheMap';
    import PathCardsFlux from '@/components/PathCardsFlux';

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
            PathCardsFlux
        },
        mounted() {
            // To retrieve path with coordinates, send API request by draw a route: https://docs.mapbox.com/playground/directions/
            store.dispatch('fetchPathCards');

            store.state.map.on('load', () => {
                    store.state.map.setStyle('mapbox://styles/mapbox/satellite-streets-v11?optimized=true'); // satellite-v9

                    this.timeout = setTimeout(() => {
                        fetch('server/info/test2.geojson') //test 2
                            .then(response => response.json())
                            .then((data) => {
                                    // save full coordinate list for later
                                    const coordinates = data.features[0].geometry.coordinates;
                                    const coordinates2 = data.features[1].geometry.coordinates;
                                    const coordinates3 = data.features[2].geometry.coordinates;
                                    const coordinates4 = data.features[3].geometry.coordinates;
                                    const coordinates5 = data.features[4].geometry.coordinates;
                                    const coordinates6 = data.features[5].geometry.coordinates;
                                    const coordinates7 = data.features[6].geometry.coordinates;
                                    const coordinates8 = data.features[7].geometry.coordinates;
                                    const coordinates9 = data.features[8].geometry.coordinates;
                                    const coordinates10 = data.features[9].geometry.coordinates;
                                    const coordinates11 = data.features[10].geometry.coordinates;
                                    const coordinates12 = data.features[11].geometry.coordinates;
                                    const coordinates13 = data.features[12].geometry.coordinates;
                                    const coordinates14 = data.features[13].geometry.coordinates;

                                    const coordinates15 = data.features[14].geometry.coordinates;
                                    const coordinates16 = data.features[15].geometry.coordinates;
                                    const coordinates17 = data.features[16].geometry.coordinates;


                                    // start by showing just the first coordinate
                                    data.features[0].geometry.coordinates = [coordinates[0]];
                                    data.features[1].geometry.coordinates = [coordinates2[0]];
                                    data.features[2].geometry.coordinates = [coordinates3[0]];
                                    data.features[3].geometry.coordinates = [coordinates4[0]];
                                    data.features[4].geometry.coordinates = [coordinates5[0]];
                                    data.features[5].geometry.coordinates = [coordinates6[0]];
                                    data.features[6].geometry.coordinates = [coordinates7[0]];
                                    data.features[7].geometry.coordinates = [coordinates8[0]];
                                    data.features[8].geometry.coordinates = [coordinates9[0]];
                                    data.features[9].geometry.coordinates = [coordinates10[0]];
                                    data.features[10].geometry.coordinates = [coordinates11[0]];
                                    data.features[11].geometry.coordinates = [coordinates12[0]];
                                    data.features[12].geometry.coordinates = [coordinates13[0]];
                                    data.features[13].geometry.coordinates = [coordinates14[0]];

                                    data.features[14].geometry.coordinates = [coordinates15[0]];
                                    data.features[15].geometry.coordinates = [coordinates16[0]];
                                    data.features[16].geometry.coordinates = [coordinates17[0]];

                                    // add it to the map
                                    store.state.map.addSource('trace', {type: 'geojson', data: data});
                                    store.state.map.addLayer({
                                        'id': 'trace',
                                        'type': 'line',
                                        'source': 'trace',
                                        'paint': {
                                            'line-opacity': 0.75,
                                            'line-color': {
                                                type: 'categorical',
                                                property: 'color',
                                                stops: [
                                                    ['red', 'red'],
                                                    ['green', 'green'],
                                                    ['blue', 'blue'],
                                                    ['yellow', 'yellow'],
                                                    ['aqua', 'aqua'],
                                                    ['brown', 'brown'],
                                                    ['purple', 'purple'],
                                                    ['white', 'white']
                                                ]
                                            },
                                            'line-width': {
                                                type: 'categorical',
                                                property: 'line-width',
                                                stops: [
                                                    ['7', 7],
                                                    ['0', 0],
                                                    ['3', 3],
                                                ]
                                            }
                                        }
                                    });

                                    // setup the viewport
                                    store.state.map.flyTo({'center': coordinates[0], 'zoom': 6, 'speed': 0.5});
                                    store.state.map.setPitch(10);

                                    // on a regular basis, add more coordinates from the saved list and update the map
                                    // c#, where # is a number of chapter
                                    let c1 = 0; // 1.hometown
                                    let c2 = 0; // 2.quarantine
                                    let c3 = 0; // 3.outskirts
                                    let c4 = 0; // 4.bill's town
                                    let c5 = 0; // 5.pittsburgh
                                    let c6 = 0; // 6.suburbs
                                    let c7 = 0; // 7.tommy's dam
                                    let c8 = 0; // 8.university
                                    let c9 = 0; // 9.lakeside resort
                                    let c10 = 0; // 10.bus depot
                                    let c11 = 0; // 11.firefly lab
                                    let c12 = 0; // 12.epilogue
                                    let c13 = 0; // 12.epilogue
                                    let c14 = 0; // 12.epilogue
                                    let c15 = 0; // 12.epilogue

                                    let c16 = 0; // 12.epilogue
                                    let c17 = 0; // 12.epilogue

                                    let delay = 175;
                                    let outer = this;

                                    this.timer = window.setTimeout(function request() {

                                        if (c1 < coordinates.length) { // 1.hometown

                                            data.features[0].geometry.coordinates.push(
                                                coordinates[c1]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates[c1]);
                                            c1++;
                                            store.state.map.flyTo({
                                                'center': coordinates[c1],
                                                'zoom': 8,
                                                'speed': 0.2
                                            });
                                            outer.timer = setTimeout(request, delay);

                                        } else if (c2 < coordinates2.length) { // 2.quarantine, fly from TX to MA
                                            if (c2 === 0) {
                                                delay = 75; // 75
                                            }
                                            data.features[1].geometry.coordinates.push(
                                                coordinates2[c2]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates2[c2]);
                                            c2++;

                                            store.state.map.flyTo({
                                                'center': coordinates2[c2],
                                                'zoom': 7,
                                                'speed': 0.3
                                            });

                                            outer.timer = setTimeout(request, delay);

                                        } else if (c3 < coordinates3.length) { // 3. from Boston to Lincoln
                                            if (c3 === 0) {
                                                delay = 120; // 75
                                            }
                                            data.features[2].geometry.coordinates.push(
                                                coordinates3[c3]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates3[c3]);
                                            c3++;

                                            store.state.map.flyTo({
                                                'center': coordinates3[c3],
                                                'zoom': 11,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);

                                        } else if (c4 < coordinates4.length) { // 4. from Lincoln to Pittsburgh_part1
                                            if (c4 === 0) {
                                                delay = 15; // 50
                                            }
                                            data.features[3].geometry.coordinates.push(
                                                coordinates4[c4]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates4[c4]);
                                            c4++;

                                            store.state.map.flyTo({
                                                'center': coordinates4[c4],
                                                'zoom': 9,
                                                'speed': 0.4
                                            });
                                            outer.timer = setTimeout(request, delay);

                                        } else if (c5 < coordinates5.length) { // 5. fly to Boston-Pittsburgh path (from 1st part to 2nd)
                                            if (c5 === 0) {
                                                delay = 20; // 60
                                            }
                                            data.features[4].geometry.coordinates.push(
                                                coordinates5[c5]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates5[c5]);
                                            c5++;

                                            store.state.map.flyTo({
                                                'center': coordinates5[c5],
                                                'zoom': 6,
                                                'speed': 0.4
                                            });

                                            outer.timer = setTimeout(request, delay);

                                        } else if (c6 < coordinates6.length) { // 6. from Boston to Pittsburgh_part2
                                            if (c6 === 0) {
                                                delay = 15; // 60
                                            }
                                            data.features[5].geometry.coordinates.push(
                                                coordinates6[c6]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates6[c6]);
                                            c6++;

                                            store.state.map.flyTo({
                                                'center': coordinates6[c6],
                                                'zoom': 7,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c7 < coordinates7.length) { // 7. from Pittsburgh to Jackson, part1
                                            if (c7 === 0) {
                                                delay = 60; // 60
                                            }
                                            data.features[6].geometry.coordinates.push(
                                                coordinates7[c7]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates7[c7]);
                                            c7++;

                                            store.state.map.flyTo({
                                                'center': coordinates7[c7],
                                                'zoom': 9,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c8 < coordinates8.length) { // 8. from Pittsburgh to Jackson, gap transition
                                            if (c8 === 0) {
                                                delay = 35; // 60
                                            }
                                            data.features[7].geometry.coordinates.push(
                                                coordinates8[c8]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates8[c8]);
                                            c8++;

                                            store.state.map.flyTo({
                                                'center': coordinates8[8],
                                                'zoom': 7,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c9 < coordinates9.length) { // 9. from Pittsburgh to Jackson, part2
                                            if (c9 === 0) {
                                                delay = 40; // 60
                                            }
                                            data.features[8].geometry.coordinates.push(
                                                coordinates9[c9]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates9[c9]);
                                            c9++;

                                            store.state.map.flyTo({
                                                'center': coordinates9[c9],
                                                'zoom': 7,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c10 < coordinates10.length) { // 10. from Jackson to Colorado (University)
                                            if (c10 === 0) {
                                                delay = 15; // 60
                                            }
                                            data.features[9].geometry.coordinates.push(
                                                coordinates10[c10]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates10[c10]);
                                            c10++;

                                            store.state.map.flyTo({
                                                'center': coordinates10[c10],
                                                'zoom': 7,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c11 < coordinates11.length) { // 11. from Colorado (University) to Silver Lake
                                            if (c11 === 0) {
                                                delay = 15; // 60
                                            }
                                            data.features[10].geometry.coordinates.push(
                                                coordinates11[c11]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates11[c11]);
                                            c11++;

                                            store.state.map.flyTo({
                                                'center': coordinates11[c11],
                                                'zoom': 10,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c12 < coordinates12.length) { // 12. from Silver Lake to Utah (part1)
                                            if (c12 === 0) {
                                                delay = 20; // 60
                                            }
                                            data.features[11].geometry.coordinates.push(
                                                coordinates12[c12]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates12[c12]);
                                            c12++;

                                            store.state.map.flyTo({
                                                'center': coordinates12[c12],
                                                'zoom': 9,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c13 < coordinates13.length) { // 13. from Silver Lake to Utah (transition)
                                            if (c13 === 0) {
                                                delay = 20; // 60
                                            }
                                            data.features[12].geometry.coordinates.push(
                                                coordinates13[c13]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates13[c13]);
                                            c13++;

                                            store.state.map.flyTo({
                                                'center': coordinates13[c13],
                                                'zoom': 8,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c14 < coordinates14.length) { // 13. from Silver Lake to Utah (part_2)
                                            if (c14 === 0) {
                                                delay = 20; // 60
                                            }
                                            data.features[13].geometry.coordinates.push(
                                                coordinates14[c14]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates14[c14]);
                                            c14++;

                                            store.state.map.flyTo({
                                                'center': coordinates14[c14],
                                                'zoom': 9,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c15 < coordinates15.length) { // 14. from Utah to Jackson (part_1)
                                            if (c15 === 0) {
                                                delay = 50; // 60
                                            }
                                            data.features[14].geometry.coordinates.push(
                                                coordinates15[c15]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates15[c15]);
                                            c15++;

                                            store.state.map.flyTo({
                                                'center': coordinates15[c15],
                                                'zoom': 7,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c16 < coordinates16.length) { // 15. from Utah to Jackson (transition))
                                            if (c16 === 0) {
                                                delay = 50; // 60
                                            }
                                            data.features[15].geometry.coordinates.push(
                                                coordinates16[c16]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates16[c16]);
                                            c16++;

                                            store.state.map.flyTo({
                                                'center': coordinates16[c16],
                                                'zoom': 7,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else if (c17 < coordinates17.length) { // 16. from Utah to Jackson (part_2)
                                            if (c17 === 0) {
                                                delay = 50; // 60
                                            }
                                            data.features[16].geometry.coordinates.push(
                                                coordinates17[c17]
                                            );
                                            store.state.map.getSource('trace').setData(data);
                                            store.state.map.panTo(coordinates17[c17]);
                                            c17++;

                                            store.state.map.flyTo({
                                                'center': coordinates17[c17],
                                                'zoom': 8,
                                                'speed': 0.5
                                            });

                                            outer.timer = setTimeout(request, delay);
                                        } else {
                                            // back to the general map view
                                            store.state.map.flyTo({
                                                'zoom': 3,
                                                'speed': 0.5,
                                            });

                                            // restore interactive map and clear intervals
                                            store.state.map.scrollZoom.enable();
                                            store.state.map.dragPan.enable();
                                            window.clearInterval(outer.timer);
                                            window.clearTimeout(outer.timeout);
                                        }
                                    }, delay);
                                }
                            );
                    }, 10000);
                }
            );
        },
        beforeDestroy() {
            //  Cleanup interval
            clearInterval(this.timer);
            //  Cleanup any pending timeouts
            clearTimeout(this.timeout);
            store.state.map = null;
        }
    }
</script>

<style scoped>
    html {
        color: aqua;
    }

    @media only screen and (max-width: 600px) {
        .carousel {
            width: 50%;
            height: auto;
        }
    }

    @media only screen and (min-width: 1600px) {
        .carousel {
        padding-top: 50px;
        }
    }
</style>
