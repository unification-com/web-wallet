<template>
  <notifications group="walletNotifications" :duration="10000" width="100%" position="bottom right" />
</template>

<style>
.vue-notification-group {
  display: block;
  position: fixed;
  z-index: 5000;
}
.vue-notification-wrapper {
  display: block;
  overflow: hidden;
  width: 100%;
  margin: 0;
  padding: 0;
}
.notification-title {
  font-weight: 900;
  font-size: 18px;
}
.vue-notification-template {
  display: block;
  box-sizing: border-box;
  background: white;
  text-align: left;
}
.vue-notification {
  display: block;
  box-sizing: border-box;
  text-align: left;
  font-size: 16px;
  padding: 10px;
  margin: 0 5px 5px;
  color: white;
  background: #2d6ba6;
  border-left: 10px solid #163552;
}
.vue-notification.warn {
  background: #f48a06;
  border-left-color: #9e5803;
}
.vue-notification.error {
  background: #e54d42;
  border-left-color: #b82e24;
}
.vue-notification.success {
  background: #42a85f;
  border-left-color: #20522e;
}
.vn-fade-enter-active,
.vn-fade-leave-active,
.vn-fade-move {
  transition: all 0.5s;
}
.vn-fade-enter,
.vn-fade-leave-to {
  opacity: 0;
}
</style>
