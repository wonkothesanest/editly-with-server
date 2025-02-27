import express from "express";
import multer from "multer";
import fs from "fs";
import { exec } from "child_process";
import JSON5 from "json5";
import path from "path";
import { v4 as uuidv4 } from "uuid"; // UUID generator
import { fileURLToPath } from "url";
import { dirname } from "path";

const app = express();
const PORT = 3000;
const OUTPUT_DIR = "/outputs"; // Ensure this directory exists

app.use(express.json());

app.post("/render", async (req, res) => {
    try {
        console.log("Incoming Request Body:", req.body);

        // Generate a unique job ID
        const jobId = uuidv4();

	const keepFiles = req.query.keepFiles === "true";
        // Extract file extension from `outPath` if provided, otherwise default to `.mp4`
        let fileExtension = ".mp4"; // Default extension
        if (req.body.outPath) {
            fileExtension = path.extname(req.body.outPath) || ".mp4"; // Extract extension
        }

        // Create filenames based on GUID and extracted extension
        const json5FilePath = `${OUTPUT_DIR}/${jobId}.json5`;
        const outputFilePath = `${OUTPUT_DIR}/${jobId}${fileExtension}`;

        // Modify JSON5 input to use the generated output file path
        const json5Parsed = req.body;
        json5Parsed.outPath = outputFilePath;

        // Save the JSON5 config file
        fs.writeFileSync(json5FilePath, JSON.stringify(json5Parsed, null, 2));

        console.log(`Processing video with job ID: ${jobId}...`);
        exec(`editly ${json5FilePath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing editly: ${error.message}`);
                return res.status(500).json({ error: "Video rendering failed" });
            }
            console.log(`Video processing completed for job ID: ${jobId}`);

            // Check if the output file exists before sending
            if (!fs.existsSync(outputFilePath)) {
                return res.status(500).json({ error: "Output file not found" });
            }

            // Send the rendered video file as response
            res.download(outputFilePath, `${jobId}${fileExtension}`, (err) => {
                if (err) console.error("File download error:", err);
                
		// Check if `keepFiles` is enabled via query parameter
                if (!keepFiles) {
                    console.log(`Cleaning up files for job ID: ${jobId}`);
                    fs.unlinkSync(json5FilePath);
                    fs.unlinkSync(outputFilePath);
                } else {
                    console.log(`Keeping files for job ID: ${jobId}`);
                }
            });
        });

    } catch (err) {
        console.error("Processing error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Health check route
app.get("/", (req, res) => {
    res.json({ status: "Editly server running..." });
});

// Ensure the output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

app.listen(PORT, () => {
    console.log(`🚀 Editly API is running at http://localhost:${PORT}`);
});

