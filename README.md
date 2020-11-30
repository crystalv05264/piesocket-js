# PieSocket Javascript Client

## Usage

Initialize the Piesocket class
```javascript
var piesocket = new Piesocket({
    cluster_id: 'YOUR_CLUSTER_ID',
    api_key: 'YOUR_API_KEY'    
});
```


Subscribe to a channel
```javascript
var channel = piesocket.subscribe(channelId); //channelId can any integere b/w 1-100000
```

Listen to messages/events

```javascript
channel.on('message',function(msg){
    console.log(msg);
})
```