<template>
  <div class="home">
    <Map></Map>
  </div>
</template>

<script>
// @ is an alias to /src
import Map from '@/components/TheMap';


export default {
  name: 'Home',
  components: {
    Map
  }
}
</script>

<style>
  html {
    background-color: black;
  }
</style>