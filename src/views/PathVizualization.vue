<template>
    <div class="path">
        <TheMap></TheMap>
    </div>
</template>

<script>
    // @ is an alias to /src
    // import ThePath from '@/components/ThePath';
    import TheMap from '@/components/TheMap';
    import store from "../store/index"

    export default {
        name: 'PathViz',
        components: {
            TheMap
        },
        data() {
            return {
                pathCoordinates: [],
                isPathStarted: false,
                timer: null,
                timeout: null
            }
        },
        mounted() {
            store.state.map.on('load', () => {
                store.state.map.setStyle('mapbox://styles/mapbox/satellite-streets-v11?optimized=true');

                this.timeout = setTimeout(() => {
                    fetch('server/info/routes_hometown.geojson')
                        .then(response => response.json())
                        .then((data) => {
                            console.log(data.features[0].geometry.coordinates);

                            // save full coordinate list for later
                            const coordinates = data.features[0].geometry.coordinates;

                            // start by showing just the first coordinate
                            data.features[0].geometry.coordinates = [coordinates[0]];

                            // add it to the map
                            store.state.map.addSource('trace', {type: 'geojson', data: data});
                            store.state.map.addLayer({
                                'id': 'trace',
                                'type': 'line',
                                'source': 'trace',
                                'paint': {
                                    'line-color': 'red',
                                    'line-opacity': 0.75,
                                    'line-width': 7
                                }
                            });

                            // setup the viewport
                            store.state.map.flyTo({'center': coordinates[0], 'zoom': 5, 'speed': 0.8});
                            store.state.map.setPitch(10);

                            // on a regular basis, add more coordinates from the saved list and update the map
                            let i = 0;
                            this.timer = window.setInterval(() => {
                                if (i < coordinates.length) {
                                    data.features[0].geometry.coordinates.push(
                                        coordinates[i]
                                    );
                                    store.state.map.getSource('trace').setData(data);
                                    store.state.map.panTo(coordinates[i]);
                                    i++;
                                    if (i > 2) {
                                        store.state.map.flyTo({'center': coordinates[i], 'zoom': 8, 'speed': 0.2});
                                    }
                                    // if (i > 100) {
                                    //     store.state.map.flyTo({'center': coordinates[i], 'zoom': 7, 'speed': 0.6});
                                    // }
                                    // if (i > 200) {
                                    //     store.state.map.flyTo({'center': coordinates[i], 'zoom': 9, 'speed': 0.8});
                                    // }
                                } else {
                                    window.clearInterval(this.timer);
                                }
                            }, 75); // 10
                        });
                }, 2000);
            });
        },
        beforeDestroy() {
            //  Cleanup interval
            clearInterval(this.timer);
            //  Cleanup any pending timeouts
            clearTimeout(this.timeout);
        }
    }
</script>
