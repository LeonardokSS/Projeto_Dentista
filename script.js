const express = require('express');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
const port = 3000;
const methodOverride = require('method-override');
const path = require("path");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static('imagens'));

app.use(session({
    secret: 'meu_segredo_simples_' + Math.random().toString(36).substring(2),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }
}));

function verificarLogin(req, res, next) {
    if (req.session && req.session.logado) {
        next();
    } else {
        res.redirect('/login');
    }
}

const url = "mongodb+srv://admin:Fiapj9cpD@cluster0.am3lpwp.mongodb.net/consultorio?retryWrites=true&w=majority&appName=Cluster0";
const dbName = 'consultorio';
const collectionPacientes = 'pacientes';
const collectionConsultas = 'consultas';
const collectionVendas = 'vendas';

// Variaveis para o deploy


app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;
    
    if (usuario === 'admin' && senha === 'admin') {
        req.session.logado = true;
        res.redirect('/');
    } else {
        res.redirect('/login?erro=1');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/', verificarLogin, (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/consultas', verificarLogin, (req, res) => {
    res.sendFile(__dirname + '/cadastro-consultas.html');
});

app.get('/pacientes', verificarLogin, (req, res) => {
    res.sendFile(__dirname + '/pacientes.html');
});

app.get('/vendas', verificarLogin, (req, res) => {
    res.sendFile(__dirname + '/consultas.html');
});

app.get('/caledario', verificarLogin, (req, res) => {
    
});

app.get('/cadastro-pacientes', verificarLogin, (req, res) => {
    res.sendFile(__dirname + "/cadastro-pacientes.html");
});

app.post('/cadastro-pacientes', verificarLogin, async (req, res) => {
    const novoPaciente = req.body;
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionPacientes);

        const result = await collection.insertOne(novoPaciente);
        console.log(`Paciente cadastrado com sucesso. ID: ${result.insertedId}`);

        res.redirect('/');
    } catch (err) {
        console.error('Erro ao cadastrar o paciente: ', err);
        res.status(500).send('Erro ao cadastrar o paciente.');
    } finally {
        client.close();
    }
});

app.get('/lista_pacientes', verificarLogin, async (req, res) => {
    const client = new MongoClient(url);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionPacientes);

        const pacientes = await collection.find({}, {
            projection: { nome: 1, idade: 1, data_nascimento: 1, RG: 1, telefone: 1, _id: 1 , sobre:1 }
        }).toArray();

        res.json(pacientes);
    } catch (err) {
        console.error('Erro ao buscar pacientes: ', err);
        res.status(500).send('Erro ao buscar pacientes.');
    } finally {
        client.close();
    }
});

app.get('/pacientes/:id', verificarLogin, async (req, res) => {
    const { id } = req.params;
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionPacientes);

        const paciente = await collection.findOne({ _id: new ObjectId(id) });
        if (!paciente) return res.status(404).send('Paciente não encontrado');

        res.json(paciente);
    } catch (err) {
        console.error('Erro ao buscar paciente:', err);
        res.status(500).send('Erro ao buscar paciente.');
    } finally {
        client.close();
    }
});

app.get('/cadastro-consultas', verificarLogin, (req, res) => {
    res.sendFile(__dirname + '/cadastro-consultas.html');
});

app.post('/cadastro-consultas', verificarLogin, async (req, res) => {
    const { paciente_id, data, horario, tipo_consulta, observacoes } = req.body;
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionConsultas);

        const consultaExistente = await collection.findOne({
            data: data,
            horario: horario
        });

        if (consultaExistente) {
            return res.status(400).send(`
                <h3 style="font-family:sans-serif; color:red; text-align:center; margin-top:30px;">
                    ⚠️ Já existe uma consulta marcada nesse horário (${horario}) no dia ${data}.
                </h3>
                <p style="text-align:center;"><a href="/cadastro-consultas">Voltar</a></p>
            `);
        }

        const novaConsulta = { paciente_id, data, horario, tipo_consulta, observacoes };

        const result = await collection.insertOne(novaConsulta);
        console.log(`Consulta cadastrada com sucesso. ID: ${result.insertedId}`);

        res.redirect('/');
    } catch (err) {
        console.error('Erro ao cadastrar consulta: ', err);
        res.status(500).send('Erro ao cadastrar consulta.');
    } finally {
        client.close();
    }
});

app.get('/lista_consultas', verificarLogin, async (req, res) => {
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db(dbName);

        const consultasCollection = db.collection(collectionConsultas);
        const pacientesCollection = db.collection(collectionPacientes);

        const consultas = await consultasCollection.find({}).toArray();

        const consultasComPaciente = await Promise.all(
            consultas.map(async consulta => {
                let pacienteNome = "Paciente não encontrado";

                if (consulta.paciente_id) {
                    try {
                        const paciente = await pacientesCollection.findOne(
                            { _id: new ObjectId(consulta.paciente_id) },
                            { projection: { nome: 1 } }
                        );
                        if (paciente) {
                            pacienteNome = paciente.nome;
                        }
                    } catch (e) {
                        console.error("Erro ao buscar paciente:", e);
                    }
                }

                return {
                    _id: consulta._id,
                    tipo_consulta : consulta.tipo_consulta || "N/A",
                    data: consulta.data || consulta.data || "N/A", 
                    horario: consulta.horario || consulta.horario || "N/A",
                    paciente_nome: pacienteNome,
                    observacoes: consulta.observacoes || "-"
                };
            })
        );

        res.json(consultasComPaciente);
    } catch (err) {
        console.error('Erro ao buscar consultas:', err);
        res.status(500).send('Erro ao buscar consultas.');
    } finally {
        client.close();
    }
});

app.get('/atualizar-consulta', verificarLogin, (req, res) => {
    res.sendFile(__dirname + '/atualizar-consultas.html');
});

app.post('/atualizar-consulta', verificarLogin, async (req, res) => {
    const { id, data, horario, paciente_id, observacoes } = req.body;

    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionConsultas);

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    data,
                    horario,
                    paciente_id,
                    observacoes
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`Consulta com ID ${id} atualizada com sucesso.`);
            res.redirect('/');
        } else {
            res.status(404).send('Consulta não encontrada.');
        }

    } catch (err) {
        console.error('Erro ao atualizar consulta: ', err);
        res.status(500).send('Erro ao atualizar consulta. Por favor tente novamente mais tarde');
    } finally {
        client.close();
    }
});

app.post('/deletar-pacientes', verificarLogin, async (req, res) => {
    const { id } = req.body;

    const client = new MongoClient(url);
    try {
        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(collectionPacientes);

        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount > 0) {
            console.log(`Paciente com ID ${id} deletado com sucesso.`);
            res.redirect('/');
        } else {
            res.status(404).send('Paciente não encontrado');
        }

    } catch (err) {
        console.error('Erro ao deletar paciente:', err);
        res.status(500).send('Erro ao deletar paciente. Por favor, tente novamente mais tarde');
    } finally {
        client.close();
    }
});

app.post('/deletar-consulta', verificarLogin, async (req,res)=>{
    const { id } = req.body;

    const client = new MongoClient(url);
    try {
        await client.connect();

        const db = client.db(dbName);
        const collection = db.collection(collectionConsultas); 

        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount > 0) {
            console.log(`Consulta com ID ${id} deletada com sucesso.`);
            res.redirect('/');
        } else {
            res.status(404).send('Consulta não encontrada');
        }

    } catch (err) {
        console.error('Erro ao deletar consulta:', err);
        res.status(500).send('Erro ao deletar consulta. Por favor, tente novamente mais tarde');
    } finally {
        client.close();
    }
});

app.get('/atualizar-pacientes', verificarLogin, (req,res)=>{
    res.sendFile(__dirname + '/atualizar-pacientes.html')
})

app.post('/atualizar-pacientes', verificarLogin, async (req,res)=>{
    const { nome, idade, data_nascimento, RG, telefone, sobre } = req.body

    const client = new MongoClient(url)

    try{
        await client.connect()

        const db = client.db(dbName)
        const collection = db.collection(collectionPacientes)

        const result = await collection.updateOne(
            { nome: nome},
            { $set: {
                idade,data_nascimento,RG,telefone,sobre
            }}
        )
        if (result.modifiedCount > 0){
            console.log(`Paciente com o nome: ${nome} atualizado com sucesso.`)
            res.redirect('/')
        }else{
            res.status(404).send('Paciente não encontrado.')
        }
        
    }catch(err){
        console.error('Erro ao atualizar o paciente: ', err)
        res.status(500).send('Erro ao atualizar o paciente. Por favor tente novamente mais tarde')
    }finally{
        client.close()
    }
})

app.get('/cadastro-vendas', verificarLogin, (req, res) => {
    res.sendFile(__dirname + '/cadastro-consultas.html');
});

app.post('/cadastro-vendas', verificarLogin, async (req, res) => {
    const novaVenda = req.body;
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionVendas);

        const result = await collection.insertOne(novaVenda);
        console.log(`Venda cadastrada com sucesso. ID: ${result.insertedId}`);

        res.redirect('/');
    } catch (err) {
        console.error('Erro ao cadastrar venda: ', err);
        res.status(500).send('Erro ao cadastrar venda.');
    } finally {
        client.close();
    }
});

app.get('/lista_vendas', verificarLogin, async (req, res) => {
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionVendas);

        const vendas = await collection.find({}).toArray();
        res.json(vendas);
    } catch (err) {
        console.error('Erro ao buscar vendas:', err);
        res.status(500).send('Erro ao buscar vendas.');
    } finally {
        client.close();
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em: http://localhost:${port}`);
});