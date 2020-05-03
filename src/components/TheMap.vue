<template>
    <div id="map">
    </div>
</template>


<script>
    export default {
        name: 'Mapbox',
        mounted() {

            let mapboxgl = require('mapbox-gl/dist/mapbox-gl.js');

            mapboxgl.accessToken = 'pk.eyJ1Ijoia29uc3RhbnRpbmJpcml1a292IiwiYSI6ImNrMWsxYjc1bjBrdjQzZHBiNTlhbjBqdmwifQ.vAlGhe7KTCajh5VvGfMJow';
            let map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/dark-v10',
            });

            // Set the map's max bounds and center.
            let bounds = [
                [-126.5, 24.5], // [west, south]
                [-65.5, 49.5]  // [east, north]
            ];
            map.setMaxBounds(bounds);
            map.setCenter([-97, 40]);

            let url = "server/paths/test.geojson";

            map.on('load', () => {
                fetch(url)
                    .then(response => response.json())
                    .then((data) => {
                        map.addSource("locations", {
                            type: 'geojson',
                            data: data
                        });

                        map.addLayer({
                            'id': 'points',
                            'type': 'symbol',
                            'source': 'locations',
                            'layout': {
                                // get the icon name from the source's "icon" property
                                // concatenate the name to get an icon from the style's sprite sheet
                                'icon-image': ['concat', ['get', 'icon'], '-15'],
                                // get the icon-size and title name from the source's "title" property
                                'icon-size': ['get', 'icon-size'],
                                'text-field': ['get', 'title'],
                                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                                'text-offset': [0, 1],
                                'text-anchor': 'top'
                            }
                        });
                    });
            });
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
</style>