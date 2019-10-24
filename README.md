## Pamlight Client SDK

#### Getting started
> import { PamlightClient } from '@pamlight/client';

> const config = {  
&nbsp;&nbsp;&nbsp;&nbsp;projectId: _`<PROJECT_ID>`_  
};  
const client = new PamlightClient(config);  
client.connect();

#### sync data from backend








// continue from herre.......................
> const routeConfig = {  
&nbsp;&nbsp;&nbsp;&nbsp;routeId: 'USERS_ROUTE',  
&nbsp;&nbsp;&nbsp;&nbsp;collection:  'users',  
&nbsp;&nbsp;&nbsp;&nbsp;isSingleDocument: false  
};

> admin.route(routeConfig).query(params => {  
&nbsp;&nbsp;&nbsp;&nbsp;return {age: {$gte: 18}};  
});

#### start service after route configurations
> admin.run().then(() => {  
&nbsp;&nbsp;&nbsp;&nbsp;console.log('Pamlight service started');  
}).catch(err => {  
&nbsp;&nbsp;&nbsp;&nbsp;throw Error(err);  
});