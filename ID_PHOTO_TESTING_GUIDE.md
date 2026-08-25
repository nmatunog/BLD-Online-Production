# ID Photo Upload Feature - Testing Guide

## Current Status

✅ **Frontend Server**: Running on http://127.0.0.1:3000  
❌ **Backend Server**: Not running (PostgreSQL not available in this environment)

## What Can Be Tested

The **ID Photo Upload UI** is fully functional and testable because all image processing happens in the browser:

### Features to Test:

1. **Photo Upload Options**
   - Click "Take Photo" to use device camera
   - Click "Upload Photo" to select a file

2. **Camera Capture** (if you have camera access)
   - Position face in the frame
   - Adequate lighting check
   - Click "Capture" button

3. **Image Cropping**
   - Drag to reposition the crop area
   - Use the zoom slider to adjust
   - Preview the square 1:1 crop

4. **Image Processing**
   - Click "Process" to apply:
     - Background removal
     - White background replacement
     - Lighting optimization (brightness & contrast)
     - Resize to 300x300px

5. **Preview & Management**
   - View the processed ID photo
   - Delete and re-upload if needed
   - Continue through signup flow

## How to Test

### Option 1: Direct Frontend Testing
Navigate to: http://127.0.0.1:3000/signup

You'll see:
1. Step 1: Your name (Last name, First name, Nickname)
2. Step 2: Encounter (Encounter type, Class number)
3. **Step 3: ID Photo** ← NEW FEATURE

### Option 2: Test with Manual Inspection

Since the backend isn't running, you won't be able to complete the signup. However, you can:

1. Fill out Steps 1 and 2
2. Navigate to Step 3 (ID Photo)
3. Test the image upload/capture UI
4. Verify the image processing works
5. Inspect the processed image in the browser

### Option 3: Production Environment

For full end-to-end testing including database storage:
- Deploy to Vercel (frontend) and Railway (backend)
- Test on the production URL with real database

## Expected Behavior

### Upload Flow:
```
Select Option → Upload/Capture → Crop → Process → Preview → Continue
```

### Processing Pipeline:
```
Original Image → Crop to Square → Remove Background → 
Add White Background → Optimize Lighting → 300x300px JPEG
```

## Technical Details

**Libraries Used:**
- `react-easy-crop`: Interactive cropping interface
- `@imgly/background-removal`: AI-powered background removal
- Canvas API: Image manipulation and optimization

**Image Specifications:**
- Format: JPEG (95% quality)
- Size: 300x300 pixels (1:1 aspect ratio)
- Processing: Brightness +20%, Contrast +10%
- Background: Pure white (#FFFFFF)

## Known Limitations

1. **Background removal** requires decent initial lighting for best results
2. **Browser compatibility**: 
   - Camera capture requires HTTPS or localhost
   - Background removal works best on modern browsers (Chrome, Edge, Safari)
3. **Photo size**: Base64 encoding increases size ~33%
4. **Performance**: Background removal may take 2-5 seconds depending on device

## Troubleshooting

### Camera Not Working
- Ensure browser has camera permissions
- Must use HTTPS or localhost (HTTP won't work in production)
- Try using "Upload Photo" instead

### Processing Takes Long Time
- Background removal is computationally intensive
- Wait 3-10 seconds for processing to complete
- Try with smaller images if timeout occurs

### Image Quality Issues
- Use good lighting when taking photo
- Ensure face is well-lit and centered
- Plain background works best for removal

## Next Steps for Full Testing

1. **Set up local PostgreSQL** OR
2. **Use production database URL** from Railway
3. **Deploy to staging environment** for full integration testing

## Files Modified

- `frontend/components/IdPhotoUpload.tsx` - New component
- `frontend/app/(auth)/signup/page.tsx` - Added step 3
- `frontend/types/api.types.ts` - Added idPhoto field
- `backend/src/auth/dto/signup.dto.ts` - Added idPhoto field
- `backend/src/auth/auth.service.ts` - Photo storage logic

## PR Details

**Branch**: `cursor/id-photo-upload-d4f9`  
**Pull Request**: [#2](https://github.com/nmatunog/BLD-Online-Production/pull/2)  
**Status**: Draft (ready for review after testing)
