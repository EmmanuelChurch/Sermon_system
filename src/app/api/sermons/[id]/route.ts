import { NextRequest, NextResponse } from 'next/server';
import { getSermonById, saveSermon, deleteSermon } from '@/lib/local-storage';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Properly await params
    const params = await Promise.resolve(context.params);
    const sermonId = params.id;
    
    if (!sermonId) {
      return NextResponse.json(
        { error: 'Sermon ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Fetching sermon with ID: ${sermonId}`);
    const sermon = getSermonById(sermonId);

    if (!sermon) {
      console.log(`Sermon not found with ID: ${sermonId}`);
      return NextResponse.json(
        { error: 'Sermon not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(sermon);
  } catch (error) {
    console.error('Error fetching sermon:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sermon' },
      { status: 500 }
    );
  }
}

// Update a sermon
export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Properly await params
    const params = await Promise.resolve(context.params);
    const sermonId = params.id;
    
    const updates = await request.json();
    
    // Get the existing sermon
    const sermon = getSermonById(sermonId);
    
    if (!sermon) {
      return NextResponse.json(
        { error: 'Sermon not found' },
        { status: 404 }
      );
    }
    
    // Apply updates
    const updatedSermon = saveSermon({
      ...sermon,
      ...updates,
      updated_at: new Date().toISOString()
    });
    
    return NextResponse.json(updatedSermon);
  } catch (error) {
    console.error('Error updating sermon:', error);
    return NextResponse.json(
      { error: 'Failed to update sermon' },
      { status: 500 }
    );
  }
}

// Delete a sermon
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Properly await params
    const params = await Promise.resolve(context.params);
    const sermonId = params.id;
    
    if (!sermonId) {
      return NextResponse.json(
        { error: 'Sermon ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Deleting sermon with ID: ${sermonId}`);
    
    // Check if the sermon exists
    const sermon = getSermonById(sermonId);
    if (!sermon) {
      console.log(`Sermon not found with ID: ${sermonId}`);
      return NextResponse.json(
        { error: 'Sermon not found' },
        { status: 404 }
      );
    }
    
    // Delete the sermon
    deleteSermon(sermonId);
    
    return NextResponse.json({
      success: true,
      message: 'Sermon deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting sermon:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete sermon' },
      { status: 500 }
    );
  }
} 