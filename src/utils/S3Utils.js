import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();


AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION 
});
const s3 = new AWS.S3();

const uploadFile = async (localFilePath, folderName) => {
    try{
        if(!localFilePath){
            return null;
        }
        const fileContent = fs.readFileSync(localFilePath);
        const imageType = path.extname(localFilePath);
        const imageName = path.basename(localFilePath).toLowerCase().split(" ").join("-").split(".").join("-") + "-" + Date.now() + imageType;

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: folderName + "/" + imageName,
            Body: fileContent
        };
        const result = await s3.upload(params).promise();
        fs.unlinkSync(localFilePath);
        return result.Location;
    }
    catch(error){
        console.log(error);
        return null;
    }
}

const deleteFile = async (key, folderName) => {
    const imageKey = key.split("/").pop();
    try{
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: folderName + "/" + imageKey
        };
        console.log(params)
        await s3.deleteObject(params).promise();
    }
    catch(error){
        console.log(error);
        return null;
    }
}

const createFolder = async (folderName) => {
    try{
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: folderName + "/",
            Body: ""
        };
        await s3.upload(params).promise();
        return true;
    }
    catch(error){
        console.log(error);
        return null;
    }
}

const deleteFolder = async (folderName) => {
    try {
        const listParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Prefix: folderName + "/"
        };

        const listedObjects = await s3.listObjectsV2(listParams).promise();

        if (listedObjects.Contents.length === 0) return;

        const deleteParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Delete: { Objects: [] }
        };

        listedObjects.Contents.forEach(({ Key }) => {
            deleteParams.Delete.Objects.push({ Key });
        });

        await s3.deleteObjects(deleteParams).promise();

        // Check if there are more objects to delete
        if (listedObjects.IsTruncated) await deleteFolder(folderName);

        return true;
    } catch (error) {
        console.log(error);
        return null;
    }
}

export { uploadFile, deleteFile, createFolder, deleteFolder };