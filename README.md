# Pamlight Client SDK

[Pamlight](https://pamlight.com) is a service for managing realtime connections to your database with whatever technology it is powered by. This tool (Admin SDK) is vital for creating secured communication channel between your server and the Pamlight core server.

## Support/Compatibility
* **Angular** - Supports Angular 2+
* **React**
* **Vue**

## Getting started
For more detailed instructions and guides on how Pamlight works, see our [official documentations here](https://pamlight.com) as well as [creating new projects](https://pamlight.com).

#### Installation
Install pamlight client sdk via npm by running the following command: 
> `npm install @pamlight/client`

#### Setup
> import { PamlightClient } from '@pamlight/client';

> const config = {  
&nbsp;&nbsp;&nbsp;&nbsp;projectId: _`<PROJECT_ID>`_  
};  
const client = new PamlightClient(config);  
client.connect().then(() => {  
&nbsp;&nbsp;&nbsp;&nbsp;console.log('Pamlight connected successfully');  
}).catch(err => {  
&nbsp;&nbsp;&nbsp;&nbsp;throw Error(err);  
});

#### sync data from database
Syncing data changes from database is a straight forward process. This is done by calling sync method on the connected client and passing the payload which contains information required by the server to generate query data from. The result of sync method call is an observable of the data matched by the query generated by the server based on the payload passed to it. [Read more here](https://pamlight.com) to see how data is passed between client and server.

const payload = { docId: '123' };  
client.sync(_`<ROUTE_ID>`_, payload).subscribe(data => {  
&nbsp;&nbsp;&nbsp;&nbsp;console.log('Data received ', data);  
}, err => {  
&nbsp;&nbsp;&nbsp;&nbsp;throw Error(\`Pamlight sync error ${err}`);  
});

#### write data to database
Writing data to your database is by calling the write method on the connected client object.

const payload = {  
&nbsp;&nbsp;&nbsp;&nbsp;docId: '12345',  
&nbsp;&nbsp;&nbsp;&nbsp;data: {name: 'Harry James}  
};  
client.write(_`<ROUTE_ID>`_, payload, true).subscribe(data => {  
&nbsp;&nbsp;&nbsp;&nbsp;console.log('Write operation completed');  
});

### Further Reading
For further reading and information, check more [anvanced read operations](https://pamlight.com) as well as [advanced write operations](https://pamlight.com)