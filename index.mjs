import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {PutCommand, ScanCommand, DynamoDBDocumentClient, GetCommand, UpdateCommand, DeleteCommand} from "@aws-sdk/lib-dynamodb";
import {randomUUID} from 'crypto';

const dynamoDbClient = new DynamoDBClient();

const ddbDocClient = DynamoDBDocumentClient.from(dynamoDbClient);

const TABLE_NAME = 'Tasks';

export const handler = async (event, context) => {

    console.log("Evernt -> ", event);

    let response;

    try {

        const httpMethod = event.requestContext.http.method;
        const path = event.requestContext.http.path;

        switch (httpMethod) {
            case 'POST':
                const taskData = JSON.parse(event.body);
                response = await addTask(taskData);
                break;

            case 'GET':
                const taskId = await extractTasks(path);
                if(taskId) {
                    response = await getTaskById(taskId);
                } else {
                    response = await getTasks();
                }
                break;

            case 'PUT':
                const taskIdToUpdate = await extractTasks(path);
                const taskToUpdate = JSON.parse(event.body);
                response = await updateTask(taskIdToUpdate, taskToUpdate);
                break;

            case 'DELETE':
                const taskIdToDelete = await extractTasks(path);
                if(taskIdToDelete) {
                    response = await deleteTask(taskIdToDelete);
                } else {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({
                            message: "ID de la tarea no proporcionado",
                        })
                    }
                }
                break;

            default:
                response = {
                    statusCode: 405,
                    body: JSON.stringify({message: 'Método no permitido'}),
                };
                break;
        }

    } catch (error) {
        response = {
            statusCode: 500,
            body: JSON.stringify({
                message: error.message,
            })
        }
    }

    return response;
}

const addTask = async (taskData) => {
    const params = {
        TableName: TABLE_NAME,
        Item: {
            taskId: randomUUID(),
            taskName: taskData.taskName,
            completed: taskData.completed || false,
        }
    }
    const result = await ddbDocClient.send(new PutCommand(params));

    console.log(`Result de AddTask-> ${JSON.stringify(result, null, 2)}`);

    return {
        statusCode: 201,
        body: JSON.stringify({message: `Task Added: ${taskData.taskId}`}),
    }
}

const getTasks = async () => {
    const params = {
        TableName: TABLE_NAME,
    }

    const result = await ddbDocClient.send(new ScanCommand(params));

    return {
        statusCode: 200,
        body: JSON.stringify(result.Items)
    };
}

const getTaskById = async (taskId) => {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            taskId: taskId,
        },
    }
    const result = await ddbDocClient.send(new GetCommand(params));


    if (result.Item) {
        return {
            "statusCode": 200,
            "body": JSON.stringify(result.Item)
        }
    } else {
        return {
            "statusCode": 404,
            "body": JSON.stringify({"message": "Tarea no encontrada"})
        }
    }
}

const updateTask = async (taskId, taskData) => {
    const params = {
        TableName: TABLE_NAME,
        Key: {taskId},
        UpdateExpression: 'set taskName = :taskName, completed = :completed',
        ExpressionAttributeValues: {
            ':taskName': taskData.taskName,
            ':completed': taskData.completed,
        },
        ReturnValues: 'ALL_NEW'
    };

    const result = await ddbDocClient.send(new UpdateCommand(params));

    console.log(`Elemento Actualizado -> ${JSON.stringify(result, null, 2)}`);

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: JSON.stringify(`Tarea actualizada ${taskData.taskId}`),
            updatedTask: result.Attributes
        })
    }
}

const deleteTask = async(taskId,) => {
    const params = {
        TableName: TABLE_NAME,
        Key: {taskId: taskId},
        returnValues: 'ALL_OLD' //Esta opción devolverá el item eliminado si existe
    }

    const result = await ddbDocClient.send(new DeleteCommand(params));

    console.log(result);

    if(result.Attributes) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Tarea eliminada ${taskId}`,
                deleteTask: result.Attributes
            })
        }
    } else {
        return {
            statusCode: 404,
            body: JSON.stringify({
                message: JSON.stringify({message: "Tarea no encontrada"})
            })
        }
    }
}

const extractTasks = async (path) => {
    const pathParts = path.split("/");
    return pathParts.length === 3 ? pathParts[2] : null;
}
