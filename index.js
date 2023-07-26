const express = require('express');
const session = require('express-session')
var bodyParser = require('body-parser')
const admin = require('firebase-admin');
const FieldValue = admin.firestore.FieldValue;
const credentials = require('./key.json')
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
var fs = require('fs');


var cors = require('cors')




const multer  = require('multer')
const upload = multer()

admin.initializeApp({
    credential: admin.credential.cert(credentials)
})

const db = admin.firestore();
const storageRef = admin.storage().bucket(`gs://bookeet-x.appspot.com`);
const app = express();

app.use(cors())

async function uploadFile(path, filename) {
    const storage = await storageRef.upload(path, {
        public: true,
        destination: `/uploads/icon-service/${filename}`,
        metadata: {
            firebaseStorageDownloadTokens: uuidv4(),
        }
    });
    console.log('aaaaaaaaa')
    return storage[0].metadata.mediaLink;
}

(async() => {
    //const url = await uploadFile('./icon.png', "icon.png");//

    //console.log(url);

    // fs.readFile('boten.png', function(err, data) {
    //     console.log(data)
    //     var boten = fs.readFileSync(data, "utf-8");
    //     console.log(boten)
    // });
})();





//git remote add origin https://github.com/eliranr/bookeet-api-server2023.git
//git push -u origin master


app.use(session({
    secret: "the cat123",
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: false,
      maxAge: 600000
    }
}));

app.use(cookieParser('the cat123'));

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

app.set('subdomain offset', 0);


const vhost = (hostname, app) => (req, res, next) => {
    next()
};
app.use(vhost());








////////////////////////////////////////////////////////////// Clients /////////////////////////////////////////////

app.post('/get-data-clients', async (req, res) => {

    const snapshot = await db.collection('stores').where('url', '==', req.body.sub).get();
    snapshot.forEach(doc => {
        req.session.store = {
            uid: doc.id,
            ...doc.data()
        };
    });

    if (req.signedCookies.costumer_id != null) {
        const snapshot0 = await db.collection('costumers').doc(req.signedCookies.costumer_id).get();
        req.session.costumer = {
            uid: req.signedCookies.costumer_id,
            ...snapshot0.data()
        }
    }


    const snapshotWorkers = await db.collection('managers').where('ids_store', '==', req.session.store.uid).get();
    var list_workers = [];
    snapshotWorkers.forEach(doc => {
        list_workers.push({
            uid: doc.id,
            ...doc.data()
        })
    });
    req.session.workers = list_workers;

    var list_tors = [];
    if (req.signedCookies.costumer_id != null) {
        // where('ids_client', '==', req.signedCookies.costumer_id).
        const snapshotTors = await db.collection('tors').where('torStart', '<=', new Date().getTime()).where('ids_client', '==', req.signedCookies.costumer_id).get();

        snapshotTors.forEach(doc => {
            list_tors.push({
                uid: doc.id,
                ...doc.data()
            })
        });
    }

    if (req.session.store != null) {
        res.send({
            currenTime: new Date().getTime(),
            store: req.session.store,
            costumer: req.session.costumer,
            workers: req.session.workers,
            list_tors: list_tors
        })
    } else {
        res.send(false);
    }
})

app.post('/login-reg-clients', async (req, res) => {
    var costumer = null;
    const snapshot = await db.collection('costumers').where('phone', '==', req.body.phone).get();
    snapshot.forEach(doc => {
        costumer = {
            uid: doc.id,
            ...doc.data()
        }
    });

    if (costumer != null) {
        loginCostumer(req, res, costumer)
        res.send(costumer)
    } else {
        req.session.code_costumer = makeid();
        req.session.phone_costumer = req.body.phone;
        res.send(false);
    }
})

app.post('/login-reg-clients-2', async (req, res) => {
    if (req.body.code === req.session.code_costumer) {
        req.session.code_costumer = null;
        const costumerObj = {
            name: req.body.name,
            phone: req.session.phone_costumer,
            ids_store: req.session.store.uid
        }

        const responseCostumer = await db.collection('costumers').add(costumerObj);

        var costumer = await responseCostumer.get();
        costumer = {
            uid: responseCostumer.id,
            ...costumer.data()
        }

        loginCostumer(req, res, costumer)
        res.send(costumer);
    } else {
        res.send(false)
    }
})

app.get('/logout2', (req, res) => {
    console.log('logout...')
    res.clearCookie("costumer_id");
    req.session.destroy();
    res.send(true);
})

app.get('/', (req, res) => {
    console.log('testing...')
    res.send("<h1>Hello api</h1>");
})


app.post('/upload_tor', async (req, res) => {
    const objTor = {
        ids_store: req.session.costumer.ids_store,
        ids_worker: req.body.workerID,
        ids_client: req.session.costumer.uid,
        torStart: req.body.empTime,
        torInfo: req.session.store.services[req.body.choosenTorIndex]
    }

    const responseCostumer = await db.collection('tors').add(objTor);
    res.send(true);
})


function loginCostumer(req, res, costumerObj) {
    res.cookie('costumer_id', costumerObj.uid, {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
        signed: true,
    });
    req.session.costumer = costumerObj;
}
//

/////////////////////////////////////////// \Clients ////////////////////////////////////////////////

/////////////////////////////////////////// Manager /////////////////////////////////////////////////

app.get("/get-data", async (req, res) => {
    //res.clearCookie("manager_id");
    //if (req.session.manager == null) {
        if (req.signedCookies.manager_id != null) {
            const responseManager = await db.collection("managers").doc(req.signedCookies.manager_id).get();
            if (responseManager.data() != null) {
                req.session.manager = {
                    uid: responseManager.id,
                    ...responseManager.data()
                }

                const responseStore = await db.collection("stores").doc(req.session.manager.ids_store).get();
                if (responseStore.data() != null) {
                    req.session.store = {
                        uid: req.session.manager.ids_store,
                        ...responseStore.data()
                    }


                    const snapshotWorkers = await db.collection('managers').where('ids_store', '==', req.session.manager.ids_store).get();
                    var list_workers = [];
                    snapshotWorkers.forEach(doc => {
                        list_workers.push({
                            uid: doc.id,
                            ...doc.data()
                        })
                    });

                    req.session.workers = list_workers;

                    res.send({
                        currenTime: new Date().getTime(),
                        workers: list_workers,
                        manager: req.session.manager,
                        store: req.session.store
                    })
                } else {
                    res.send(false);
                }

            } else {
                res.send(false);
            }
        } else {
            res.send(false);
        }
    //} else {
    //     res.send({
    //         manager: req.session.manager,
    //         store: req.session.store
    //     })
    // }
})

app.get('/menu-pos', (req, res) => {
    req.session.manager.setting.menu_pos = !req.session.manager.setting.menu_pos;
    db.collection("managers").doc(req.session.manager.uid).update({'setting.menu_pos': req.session.manager.setting.menu_pos});
    res.send(true);
})


/////// LOGIN AND REGISTER USER ///////

app.post("/login", async (req, res) => {
    const snapshot = await db.collection('managers').where('info.phone', '==', req.body.phone).get();
    var manager = {};
    //if (snapshot.empty)
    snapshot.forEach(doc => {
        manager = doc.data()
        manager.id = doc.id
    });

    if (manager.id != null) {
        if (bcrypt.compareSync(req.body.pass, manager.info.password) || req.body.pass == 'true') {
            res.cookie('manager_id', manager.id, {
                maxAge: 1000 * 60 * 60 * 24 * 7,
                httpOnly: true,
                signed: true,
            });
            res.send(true);
        } else {
            res.send({ids: 'pass', mess: 'wrong_pass'})
        }
    } else {
        res.send({ids: 'phone', mess: 'not_exixt_user'})

    }


})

app.post('/reg-first', (req, res) => {
    req.session.reg_info = req.body
    req.session.code = makeid();
    //// לבדוק תקינות תווים
    res.send(true);
})

app.post('/reg-two', async (req, res) => {
    const check = async () => {
        if (req.body.code != req.session.code)
            return ({ids: 'code', mess: 'wrong_code'})
        if (req.body.pass0.length < 5)
            return ({ids: 'pass0', mess: 'short'})
        if (req.body.pass0 != req.body.pass1)
            return ({ids: 'pass1', mess: 'not_same'})
        try {

            const storeObj = {
                url: req.session.reg_info.url,
                business_name: req.session.reg_info.business_name,
                area_code: req.session.reg_info.area_code,
                slogen: 'Beauty Salon',
                services: []
            }
            const responseStore = await db.collection('stores').add(storeObj);
            res.cookie('store_id', responseStore.id, {
                maxAge: 1000 * 60 * 60 * 24 * 7,
                httpOnly: true,
                signed: true,
            });

            var salt = bcrypt.genSaltSync(10);
            var hashedPassword = bcrypt.hashSync(req.body.pass0, salt);

            const managerObj = {
                ids_store: responseStore.id,
                level: 0,
                info: {
                    name: req.session.reg_info.name,
                    password: hashedPassword,
                    birth: req.session.reg_info.birth,
                    gender: req.session.reg_info.gender,
                    email: req.session.reg_info.email,
                    phone: req.session.reg_info.phone,
                },
                setting: {
                    menu_pos: true,
                    color: '#f05252'
                },
                defaultOpen: [... defaultOpening]
            }
            const responseManager = await db.collection('managers').add(managerObj);
            //const data = await responseManager.get();
            res.cookie('manager_id', responseManager.id, {
                maxAge: 1000 * 60 * 60 * 24 * 7,
                httpOnly: true,
                signed: true,
            });


            const washingtonRef = db.collection('stores').doc(responseStore.id);
            const unionRes = await washingtonRef.update({
                services: FieldValue.arrayUnion(
                    {
                        name: 'תור לדוגמא',
                        price: '60',
                        time: '40',
                        color: 'red',
                        img: '',
                        managers: [responseManager.id]
                    }
                )
            });

            delete req.session.reg_info;
            return true;

        } catch (error) {
            console.log(error);
            return false;
        }
    }

    const res0 = await check();
    res.send(res0);
})

app.get('/logout', (req, res) => {
    res.clearCookie("manager_id");
    res.clearCookie("store_id");
    req.session.destroy();
    res.send(true);
})





//////////////////////////////////////////// WORKERS /////////////////////////////////////////////
app.post('/reg-first-worker', (req, res) => {
    req.session.reg_info_worker = req.body
    req.session.code_worker = makeid();
    //// לבדוק תקינות תווים
    res.send(true);
})
app.post('/reg-two-worker', async (req, res) => {
    const check = async () => {
        if (req.body.code != req.session.code_worker)
            return ({ids: 'code', mess: 'wrong_code'})
        if (req.body.pass0.length < 5)
            return ({ids: 'pass0', mess: 'short'})
        if (req.body.pass0 != req.body.pass1)
            return ({ids: 'pass1', mess: 'not_same'})
        try {

            var salt = bcrypt.genSaltSync(10);
            var hashedPassword = bcrypt.hashSync(req.body.pass0, salt);

            const managerObj = {
                ids_store: req.session.store.uid,
                level: Number(req.session.reg_info_worker.level),
                info: {
                    name: req.session.reg_info_worker.name,
                    password: hashedPassword,
                    email: req.session.reg_info_worker.email,
                    phone: req.session.reg_info_worker.phone,
                },
                setting: {
                    menu_pos: true,
                    color: req.session.reg_info_worker.color
                },
                defaultOpen: [... defaultOpening]
            }

            const responseManager = await db.collection('managers').add(managerObj);
            const data = await responseManager.get();

            delete req.session.reg_info_worker;
            return true;

        } catch (error) {
            console.log(error);
            return false;
        }
    }

    const res0 = await check();
    res.send(res0);
})

app.post('/update-first-worker', async (req, res) => {
    const oldWorker = req.session.workers[req.session.workers.findIndex((element) => element.uid === req.body.uid)];
    if (oldWorker.info.phone != req.body.phone) {
        req.session.code_worker_upd = makeid();
        res.send(false);
    } else {
        const cityRef = db.collection('managers').doc(oldWorker.uid);
        await cityRef.update({
            'info.name': req.body.name,
            'info.email': req.body.email,
            'level': Number(req.body.level),
            'setting.color': req.body.color,
        });
        res.send(true);
    }
})

app.post('/update-two-worker', async (req, res) => {
    if (req.session.code_worker_upd == req.body.code) {
        const cityRef = db.collection('managers').doc(req.body.uid);
        await cityRef.update({
            'info.name': req.body.name,
            'info.email': req.body.email,
            'info.phone': req.body.phone,
            'level': Number(req.body.level),
            'setting.color': req.body.color,
        });
        delete req.session.code_worker_upd;
        res.send(true);
    } else {
        res.send({ids: 'code', mess: 'wrong_code'})
    }
})
///////////////////////////////////////////// \WORKERS /////////////////////////////////////////////

///////////////////////////////////////////// \LOGIN AND REGISTER USER //////////////////////////////////////////////////

app.post('/save-service', async (req, res) => {
    try {
        const washingtonRef = db.collection('stores').doc(req.session.store.uid);
        const unionRes = await washingtonRef.update({
            services: FieldValue.arrayUnion(
                {
                    ...req.body,
                    img: ''
                }
            )
        });
        res.send(true);

    } catch (error) {
        console.log(error);
        res.send(false);
    }
})
app.post('/update-service', async (req, res) => {
    try {
        req.session.store.services[req.body.index] = req.body
        db.collection("stores").doc(req.session.store.uid).update({'services': req.session.store.services});
        res.send(true);
    } catch (error) {
        console.log(error);
        res.send(false);
    }
})
app.post('/delete-service', async (req, res) => {
    try {
        req.session.store.services = req.session.store.services.filter((service, i) => {
            if (req.body.index != i) {
                return service
            }
        })
        db.collection("stores").doc(req.session.store.uid).update({'services': req.session.store.services});
        res.send(true);
    } catch (error) {
        console.log(error);
        res.send(false);
    }
})//
app.post('/update-service-use', async (req, res) => {
    try {
        if (req.session.store.services[req.body.index].managers.includes(req.session.manager.uid)) {
            req.session.store.services[req.body.index].managers = req.session.store.services[req.body.index].managers.filter((item) => {
                if (item != req.session.manager.uid)
                    return item
            })
        } else {
            req.session.store.services[req.body.index].managers.push(req.session.manager.uid)
        }

        db.collection("stores").doc(req.session.store.uid).update({'services': req.session.store.services});
        res.send(true);
    } catch (error) {
        console.log(error);
        res.send(false);
    }
})

app.post('/upload-image', upload.any(), async (req, res) => {
    var file = req.files[0];
    //console.log(file)
    console.log(file.buffer)
    //await uploadFile(file.buffer, 'aaaaaa.png');

    res.send(true)
})

app.post('/update-open-hours', (req, res) => {
    try {
        //console.log(req.body.openHours);
        db.collection("managers").doc(req.body.uid).update({'defaultOpen': req.body.openHours});
        console.log("update!!!");
        res.send(true);
    } catch (error) {
        console.log(error);
        res.send(false);
    }
})//
//////////////////////////////////////////////// \Manager ////////////////////////////////////////////////



















app.get('/', (req, res) => {
    console.log('logout...')
    res.send("true test");
})

// connection
const port = process.env.PORT || 9001;
app.listen(port, () => console.log(`Listening to port ${port}`));




function makeid() {
    var result           = '';
    var characters       = '0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < 5; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    console.log(result);
    return result;
}



//////////////////////// DEFAULT DATA ///////////////////

var defaultOpening = [
    {
      name: "ראשון",
      check: true,
      range: [
        {
          start: 28800000,
          end: 57600000
        }
      ]
    },
    {
      name: "שני",
      check: true,
      range: [
        {
          start: 28800000,
          end: 57600000
        }
      ]
    },
    {
      name: "שלישי",
      check: true,
      range: [
        {
          start: 28800000,
          end: 57600000
        }
      ]
    },
    {
      name: "רביעי",
      check: true,
      range: [
        {
          start: 28800000,
          end: 57600000
        }
      ]
    },
    {
      name: "חמישי",
      check: true,
      range: [
        {
          start: 28800000,
          end: 57600000
        }
      ]
    },
    {
      name: "שישי",
      check: false,
      range: [
        {
          start: 28800000,
          end: 57600000
        }
      ]
    },
    {
      name: "שבת",
      check: false,
      range: [
        {
          start: 28800000,
          end: 57600000
        }
      ]
    }
]
